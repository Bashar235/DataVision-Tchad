import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  TrendingUp,
  Users,
  ShieldCheck,
  Cpu,
  Activity,
  AlertCircle,
  Pencil,
  Loader2,
  Eye,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  History,
  TrendingDown,
  ChevronRight,
  UserCheck,
  Zap,
} from "lucide-react";

import SystemInfrastructure from "@/pages/admin/SystemInfrastructure";
import SystemHealthChart from "@/components/dashboard/charts/SystemHealthChart";
import SecurityCenter from "@/components/dashboard/SecurityCenter";
import StrategicOversight from "@/pages/admin/StrategicOversight";
import LanguageSwitcher from "@/components/dashboard/LanguageSwitcher";
import DataManagement from "@/pages/admin/DataManagement";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAdminStats, updateCurrentUserProfile, resolveTicket, deleteTicket, getAdminProductivity } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import ReportsTabContent from "@/components/dashboard/ReportsTabContent";
import { UserManagementTabContent } from "./UserManagement";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';

  const [activeTab, setActiveTab] = useState(currentTab);

  const { t, currentLang } = useLanguage();
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", email: "" });
  const [isSaving, setIsSaving] = useState(false);

  // Sync state with URL when it changes elsewhere (like sidebar)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Update URL search params when tab changes manually
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  useEffect(() => {
    if (user) {
      setEditForm({ full_name: user.full_name, email: user.email });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateCurrentUserProfile(editForm);
      await refreshUser();
      setIsEditOpen(false);
      toast({ title: t('common_success'), description: t('success_profile_updated') });
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast({ variant: "destructive", title: t('common_error'), description: t('error_email_exists') });
      } else {
        toast({ variant: "destructive", title: t('common_error'), description: t('common_error_desc') || t('error_update_profile_failed') });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // --- URGENT TICKETS STATE ---
  const [urgentTickets, setUrgentTickets] = useState<any[]>([]);
  const [showUrgentAlert, setShowUrgentAlert] = useState(false);
  const [hasShownUrgentAlert, setHasShownUrgentAlert] = useState(false);
  const [previewTicket, setPreviewTicket] = useState<any>(null);

  const [stats, setStats] = useState({
    datasets_count: 0,
    total_records: 0,
    users_count: 0,
    active_users_today: 0,
    online_count: 0,
    current_population_estimate: 0,
    avg_growth_rate: "0%",
    last_database_update: null as string | null,
    urgent_tickets_count: 0,
    unread_messages_count: 0,
    server_uptime: t('common_loading'),
    database_status: t('common_checking')
  });

  const [productivity, setProductivity] = useState<any>(null);
  const [selectedLeaderboardUser, setSelectedLeaderboardUser] = useState<any>(null);
  const [recentActions, setRecentActions] = useState<any[]>([]);

  const currentPeriod = searchParams.get('period') || '7d';
  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!user || (user.role !== 'admin' && user.role !== 'administrator')) {
          console.log("Skipping admin stats fetch - User is not admin");
          return;
        }
        const data = await getAdminStats(currentPeriod);
        setStats(data);
        if (data.urgent_tickets) {
          setUrgentTickets(data.urgent_tickets);
          if (data.urgent_tickets.length > 0 && !hasShownUrgentAlert) {
            setShowUrgentAlert(true);
            setHasShownUrgentAlert(true);
          }
        }
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
      }
    };
    fetchStats();
  }, [currentPeriod, user, hasShownUrgentAlert]);

  useEffect(() => {
    const fetchProductivity = async () => {
      try {
        if (!user || (user.role !== 'admin' && user.role !== 'administrator')) return;
        const data = await getAdminProductivity();
        setProductivity(data);
        
        // Extract recent actions from leaderboard for the activity feed
        const allActions: any[] = [];
        data.leaderboard.forEach((u: any) => {
          u.recent_actions.forEach((a: any) => {
            allActions.push({
              ...a,
              user_name: u.full_name,
              user_role: u.role
            });
          });
        });
        
        // Sort by timestamp desc
        allActions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecentActions(allActions.slice(0, 10));
      } catch (error) {
        console.error("Failed to fetch productivity:", error);
      }
    };
    fetchProductivity();
  }, [user]);

  const handleResolve = async (id: number) => {
    try {
      await resolveTicket(id);
      setUrgentTickets(prev => prev.filter(t => t.id !== id));
      toast({ title: t('common_success'), description: t('database_ticket_resolved_success') });
      if (previewTicket?.id === id) setPreviewTicket(null);
    } catch (error) {
      toast({ variant: "destructive", title: t('common_error'), description: t('common_error_desc') });
    }
  };

  const handleDeleteTicket = async (id: number) => {
    if (!confirm(t('database_confirm_delete_row_msg'))) return;
    try {
      await deleteTicket(id);
      setUrgentTickets(prev => prev.filter(t => t.id !== id));
      toast({ title: t('common_success'), description: t('database_row_deleted_desc') });
    } catch (error) {
      toast({ variant: "destructive", title: t('common_error'), description: t('database_delete_error') });
    }
  };


  const handleLogout = async () => {
    if (user && logout) {
      await logout();
    } else {
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("userRole");
    }
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b bg-card shrink-0">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Database className="w-8 h-8 text-primary" />
                </div>
                <div className="text-start">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                      {t('welcome_back')}, {user?.full_name}
                    </h1>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => setIsEditOpen(true)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    {t('last_login_label')}: {user?.last_login ? new Intl.DateTimeFormat(currentLang, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    }).format(new Date(user.last_login)) : t('common_na')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <LanguageSwitcher />
                <div className="text-end border-s ps-4">
                  <p className="text-sm font-medium">{user?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  {t('logout')}
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('users_edit_user')}</DialogTitle>
                <DialogDescription>{t('users_edit_user_desc')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('label_name')}</Label>
                  <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('label_email')}</Label>
                  <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>{t('common_cancel')}</Button>
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('common_save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* CRITICAL ALERTS / COMMAND CENTER */}
          {
            urgentTickets.length > 0 && (
              <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
                <div className="bg-red-50 border border-red-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-full blur-3xl opacity-50 -mr-16 -mt-16 pointer-events-none"></div>

                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-100 p-2.5 rounded-xl animate-pulse">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-red-950">{t('support_critical_alerts')}</h2>
                        <p className="text-red-700/80 text-sm">{t('support_pending_validation', { count: urgentTickets.length })}</p>
                      </div>
                    </div>
                    <Badge className="bg-red-600 hover:bg-red-700 text-white border-none px-3 py-1">
                      {urgentTickets.length} {t('support_pending_caps')}
                    </Badge>
                  </div>

                  <div className="grid gap-3 relative z-10">
                    {urgentTickets.map((ticket) => (
                      <div key={ticket.id} className="bg-white/80 backdrop-blur-sm border border-red-100/50 p-4 rounded-xl flex items-center justify-between hover:shadow-md transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                            {ticket.user_name_snapshot?.charAt(0) || "U"}
                          </div>
                          <div className="text-start">
                            <h4 className="font-bold text-slate-900 text-sm">{ticket.subject}</h4>
                            <p className="text-xs text-slate-500">
                              {t('support_reported_by')} {ticket.user_name_snapshot} • {new Date(ticket.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-9 w-9 p-0 rounded-lg hover:bg-slate-50" onClick={() => setPreviewTicket(ticket)} title={t('support_preview_message')}>
                            <Eye className="h-4 w-4 text-slate-600" />
                          </Button>
                          <Button size="sm" className="h-9 w-9 p-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200" onClick={() => handleResolve(ticket.id)} title={t('support_mark_resolved')}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteTicket(ticket.id)} title={t('common_delete')}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          }

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard_datasets')}</CardTitle>
                <Database className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">{stats.datasets_count}</div>
                <p className="text-xs text-muted-foreground">{t('stats_total_records')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard_users')}</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">
                  {stats.online_count} <span className="text-base font-normal text-muted-foreground">{t('admin_online_label')}</span> / {stats.active_users_today} <span className="text-base font-normal text-muted-foreground">{t('admin_active_today_label')}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{t('users_title')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-2"
                  onClick={() => navigate("/admin/users")}
                >
                  <Users className="w-3 h-3" />
                  {t('users_title')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('stats_total_population')}</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">{(stats.current_population_estimate / 1000000).toFixed(2)}{t('million_abbr')}</div>
                <p className="text-xs text-muted-foreground">{t('indicators_data')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('stats_gdp_growth')}</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">{stats.avg_growth_rate}</div>
                <p className="text-xs text-muted-foreground">{t('annual_average')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">{t('dashboard_overview')}</TabsTrigger>
              <TabsTrigger value="users">{t('dashboard_users')}</TabsTrigger>
              <TabsTrigger value="reports">{t('side_nav_reports')}</TabsTrigger>
              <TabsTrigger value="data-management">{t('dashboard_data_management')}</TabsTrigger>
              <TabsTrigger value="infrastructure">{t('tab_infrastructure')}</TabsTrigger>
              <TabsTrigger value="oversight">{t('strategic_oversight')}</TabsTrigger>
              <TabsTrigger value="security">{t('security_title')}</TabsTrigger>
            </TabsList>            <TabsContent value="overview" className="space-y-6">
              {/* NEW BI HUB KPI ROW */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-semibold text-emerald-900">{t('admin_total_cleaned')}</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-950">{productivity?.metrics?.analyst_total || stats.total_records || 0}</div>
                    <p className="text-xs text-emerald-700/70 mt-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> +12% {t('from_last_month')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-semibold text-blue-900">{t('admin_active_simulations')}</CardTitle>
                    <Zap className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-950">{productivity?.metrics?.researcher_total || 0}</div>
                    <p className="text-xs text-blue-700/70 mt-1 flex items-center gap-1">
                      <Zap className="h-3 w-3" /> {t('admin_productivity_hub')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-100 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-semibold text-slate-900">{t('admin_system_uptime')}</CardTitle>
                    <Activity className="h-4 w-4 text-slate-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-950">{stats.server_uptime}</div>
                    <p className="text-xs text-slate-700/70 mt-1 flex items-center gap-1">
                      <UserCheck className="h-3 w-3" /> {stats.database_status}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-semibold text-amber-900">{t('admin_pending_tasks')}</CardTitle>
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-950">{stats.urgent_tickets_count + (stats.datasets_count > 0 ? 1 : 0)}</div>
                    <p className="text-xs text-amber-700/70 mt-1">
                      {t('support_attention_required')}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-12 gap-6">
                {/* 1. SYSTEM INTEGRITY - TOP WIDE CARD FOR TOTAL INTEGRITY */}
                <Card className="col-span-12 border-slate-200/60 shadow-sm overflow-hidden">
                  <CardHeader className="text-start bg-slate-50/50 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold">{t('system_integrity')}</CardTitle>
                        <CardDescription>{t('admin_real_time_oversight')}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 border-none px-3 py-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        {t('infra_operational')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="py-6">
                    <div className="flex flex-col lg:flex-row items-stretch gap-6">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Cpu className="w-4 h-4 text-primary" />
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('model_load')}</span>
                            </div>
                            <Badge className="bg-primary/10 text-primary border-none text-[10px]">14%</Badge>
                          </div>
                          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                            <div className="bg-primary h-full w-[14%] rounded-full"></div>
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('active_sessions')}</span>
                          </div>
                          <span className="text-lg font-black text-slate-900">3</span>
                        </div>
                      </div>
                      <div className="lg:w-[60%]">
                        <SystemHealthChart height={150} />
                      </div>

                    </div>
                  </CardContent>

                </Card>

                {/* 2. RECENT EVENTS - SCROLLABLE CONTENT */}
                <Card className="col-span-12 lg:col-span-7 border-slate-200/60 shadow-sm flex flex-col max-h-[400px]">

                  <CardHeader className="text-start border-b border-slate-50 pb-4">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" />
                      {t('admin_recent_events')}
                    </CardTitle>
                    <CardDescription>{t('dashboard_recent_actions')}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 overflow-y-auto flex-1 pr-4 custom-scrollbar">
                    <div className="space-y-6">
                      {recentActions.length > 0 ? recentActions.map((action, i) => (
                        <div key={i} className="flex gap-4 relative">
                          {i !== recentActions.length - 1 && (
                            <div className="absolute left-[19px] top-10 bottom-0 w-[2px] bg-slate-100"></div>
                          )}
                          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                            action.action.includes('CLEAN') ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                            action.action.includes('REPORT') ? 'bg-blue-50 border-blue-100 text-blue-600' :
                            'bg-slate-50 border-slate-100 text-slate-600'
                          }`}>
                            {action.action.includes('CLEAN') ? <CheckCircle2 className="h-5 w-5" /> : 
                             action.action.includes('REPORT') ? <TrendingUp className="h-5 w-5" /> : 
                             <Activity className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 text-start">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-bold text-slate-900">{action.action.replace(/_/g, ' ')}</h4>
                              <span className="text-xs text-slate-400 font-medium">{new Date(action.timestamp).toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-sm text-slate-600 mb-1">
                              <span className="font-semibold text-slate-900">{action.user_name}</span> ({action.user_role})
                            </p>
                            {action.details && (
                              <div className="text-xs bg-slate-50 p-2 rounded border border-slate-100 text-slate-500 font-mono line-clamp-1">
                                {typeof action.details === 'string' ? action.details : JSON.stringify(action.details)}
                              </div>
                            )}
                          </div>
                        </div>
                      )) : (
                        <div className="py-12 text-center text-slate-400">
                          <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                          <p>{t('dh_no_activity')}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 3. LEADERBOARD & DATA PULSE */}
                <div className="col-span-12 lg:col-span-5 space-y-6 flex flex-col max-h-[400px]">

                  {/* Productivity Leaderboard */}
                  <Card className="border-slate-200/60 shadow-sm flex-1 overflow-hidden flex flex-col">
                    <CardHeader className="text-start border-b border-slate-50 shrink-0">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        {t('admin_user_leaderboard')}
                      </CardTitle>
                      <CardDescription>{t('admin_top_contributors')}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                      <div className="space-y-4">
                        {productivity?.leaderboard?.slice(0, 5).map((u: any, i: number) => (
                          <div 
                            key={i} 
                            className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group border border-transparent hover:border-slate-100"
                            onClick={() => setSelectedLeaderboardUser(u)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                  {u.full_name.charAt(0)}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white font-bold ${
                                  i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-300' : 'bg-orange-300'
                                }`}>

                                  {i + 1}
                                </div>
                              </div>
                              <div className="text-start">
                                <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{u.full_name}</p>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{u.role}</p>
                              </div>
                            </div>
                            <div className="text-end">
                              <p className="text-sm font-bold text-slate-900">{u.total_actions}</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold">{t('admin_action_count')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Data Pulse (Shrunken) */}
                  <Card className="border-slate-200/60 shadow-sm bg-slate-900 text-white overflow-hidden relative shrink-0">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <CardHeader className="text-start pb-2 relative z-10">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        {t('data_pulse_title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">{t('last_database_modification')}</p>
                          <p className="text-lg font-bold text-primary">
                            {stats.last_database_update ?
                              new Date(stats.last_database_update).toLocaleString(currentLang, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) :
                              t('common_loading')
                            }
                          </p>
                        </div>
                        <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                          <div className="text-start">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">{t('infra_status')}</p>
                            <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              {t('infra_operational')}
                            </p>
                          </div>
                          <Zap className="h-5 w-5 text-slate-700" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* USER RESUME DIALOG */}
              <Dialog open={!!selectedLeaderboardUser} onOpenChange={(open) => !open && setSelectedLeaderboardUser(null)}>

                <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
                  {selectedLeaderboardUser && (
                    <div className="bg-white">
                      <div className="bg-gradient-to-br from-primary to-primary/80 p-8 text-center text-white relative">
                        <div className="absolute top-4 right-4">
                          <Badge className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-md">
                            {selectedLeaderboardUser.role}
                          </Badge>
                        </div>
                        <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl font-black mx-auto mb-4 border border-white/30">
                          {selectedLeaderboardUser.full_name.charAt(0)}
                        </div>
                        <h2 className="text-2xl font-bold">{selectedLeaderboardUser.full_name}</h2>
                        <p className="opacity-80 text-sm mt-1">{selectedLeaderboardUser.email}</p>
                      </div>

                      <div className="p-6">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <History className="h-3 w-3" />
                          {t('admin_last_5_actions')}
                        </h3>
                        <div className="space-y-4">
                          {selectedLeaderboardUser.recent_actions.map((action: any, i: number) => (
                            <div key={i} className="flex gap-3">
                              <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                                <Activity className="h-4 w-4 text-slate-400" />
                              </div>
                              <div className="text-start">
                                <p className="text-sm font-bold text-slate-900">{action.action.replace(/_/g, ' ')}</p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                  {new Date(action.timestamp).toLocaleString(currentLang, {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <Button className="w-full font-bold h-12" onClick={() => setSelectedLeaderboardUser(null)}>
                          {t('common_close')}
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </TabsContent>


            <TabsContent value="users" className="space-y-4">
              <UserManagementTabContent />
            </TabsContent>

            <TabsContent value="data-management" className="space-y-4">
              <DataManagement />
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <ReportsTabContent />
            </TabsContent>

            <TabsContent value="infrastructure">
              <SystemInfrastructure />
            </TabsContent>

            <TabsContent value="oversight">
              <StrategicOversight />
            </TabsContent>

            <TabsContent value="security">
              <SecurityCenter />
            </TabsContent>
          </Tabs>

          {/* URGENT ALERT MODAL */}
          <Dialog open={showUrgentAlert} onOpenChange={setShowUrgentAlert}>
            <DialogContent className="max-w-md text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2 animate-pulse">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-center text-2xl font-bold text-slate-950">{t('support_attention_required')}</DialogTitle>
                <DialogDescription className="text-center text-slate-600">
                  {t('support_urgent_alerts_desc', { count: urgentTickets.length })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-center">
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12 rounded-xl" onClick={() => setShowUrgentAlert(false)}>
                  {t('support_go_to_command_center')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* PREVIEW TICKET MODAL (EMAIL STYLE) */}
          <Dialog open={!!previewTicket} onOpenChange={(open) => !open && setPreviewTicket(null)}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden bg-[#f8f9fa] border-none">
              {previewTicket && (
                <div className="font-sans">
                  {/* Header */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-center text-white">
                    <h2 className="text-2xl font-bold tracking-wide m-0">{t('nav_brand')}</h2>
                    <p className="opacity-80 text-sm font-medium mt-1">{t('support_platform_subtitle')}</p>
                  </div>

                  {/* Content */}
                  <div className="p-10 bg-white m-6 mt-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="inline-block px-4 py-1.5 rounded-full text-[11px] font-extrabold uppercase bg-red-50 text-red-700 mb-6 tracking-wide">
                      {t('support_urgent_data_issue')}
                    </div>

                    <p className="m-0 mb-2 text-sm font-bold text-slate-500 uppercase tracking-wide">{t('support_reported_by')}</p>
                    <p className="m-0 mb-6 text-base font-bold text-slate-900">
                      {previewTicket.user_name_snapshot} <span className="font-normal text-slate-500">({previewTicket.user_role_snapshot})</span> <br />
                      <span className="text-sm font-normal text-blue-600">{previewTicket.user_email_snapshot}</span>
                    </p>

                    <p className="m-0 mb-2 text-sm font-bold text-slate-500 uppercase tracking-wide">{t('contact_subject')}</p>
                    <p className="m-0 mb-6 text-base font-bold text-slate-900">{previewTicket.subject}</p>

                    <div className="bg-slate-50 border-l-4 border-red-700 p-6 rounded-lg text-slate-700 italic leading-relaxed">
                      "{previewTicket.message}"
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="bg-slate-100 p-4 text-center text-xs text-slate-400 border-t border-slate-200">
                    {t('support_preview_id', { id: previewTicket.id })}
                  </div>

                  {/* Actions */}
                  <div className="p-4 bg-white border-t border-slate-100 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setPreviewTicket(null)}>{t('common_close')}</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleResolve(previewTicket.id)}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> {t('support_mark_resolved')}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
