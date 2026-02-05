import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  TrendingUp,
  FileText,
  Users,
  MapPin,
  ShieldCheck,
  Cpu,
  Activity,
  CalendarCheck,
  AlertCircle
} from "lucide-react";
import VisualizationDashboard from "@/components/dashboard/VisualizationDashboard";
import SystemHealthChart from "@/components/dashboard/charts/SystemHealthChart";
import PredictiveAnalytics from "@/components/dashboard/PredictiveAnalytics";
import SecurityCenter from "@/components/dashboard/SecurityCenter";
import LanguageSwitcher from "@/components/dashboard/LanguageSwitcher";
import DataManagement from "@/pages/admin/DataManagement";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { getAdminStats, updateCurrentUserProfile, getUrgentTickets, resolveTicket, deleteTicket } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Loader2, Save, Eye, CheckCircle2, Trash2, AlertTriangle, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const { t, currentLang } = useLanguage();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", email: "" });
  const [isSaving, setIsSaving] = useState(false);

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
        toast({ variant: "destructive", title: t('common_error'), description: t('common_error_desc') || "Failed to update profile" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const [stats, setStats] = useState({
    active_users: 0,
    server_uptime: t('common_loading'),
    database_status: t('common_checking'),
    total_records: 0,
    current_population_estimate: 0,
    avg_growth_rate: "0%"
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log("Fetching admin stats...");
        const data = await getAdminStats();
        console.log("Admin stats result:", data);
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch admin stats", error);
      }
    };
    fetchStats();
  }, []);

  // --- URGENT TICKETS LOGIC ---
  const [urgentTickets, setUrgentTickets] = useState<any[]>([]);
  const [showUrgentAlert, setShowUrgentAlert] = useState(false);
  const [previewTicket, setPreviewTicket] = useState<any>(null);

  const fetchUrgentTickets = async () => {
    try {
      const tickets = await getUrgentTickets();
      setUrgentTickets(tickets);
      if (tickets.length > 0) {
        setShowUrgentAlert(true);
      }
    } catch (error) {
      console.error("Failed to fetch urgent tickets", error);
    }
  };

  useEffect(() => {
    fetchUrgentTickets();
  }, []);

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


  const handleLogout = () => {
    localStorage.removeItem("userRole");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
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
                  }).format(new Date(user.last_login)) : 'N/A'}
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


      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">

        {/* CRITICAL ALERTS / COMMAND CENTER */}
        {urgentTickets.length > 0 && (
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
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard_datasets')}</CardTitle>
              <Database className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-start">
              <div className="text-2xl font-bold">{stats.total_records}</div>
              <p className="text-xs text-muted-foreground">{t('stats_total_records')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard_users')}</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-start">
              <div className="text-2xl font-bold">{stats.active_users}</div>
              <p className="text-xs text-muted-foreground mb-3">{t('dashboard_active_today')}</p>
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
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-start">
              <div className="text-2xl font-bold">{(stats.current_population_estimate / 1000000).toFixed(2)}M</div>
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
        </div >

        {/* Main Tabs */}
        < Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4" >
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview">{t('dashboard_overview')}</TabsTrigger>
            <TabsTrigger value="users">{t('dashboard_users')}</TabsTrigger>
            <TabsTrigger value="data">{t('dashboard_data_management')}</TabsTrigger>
            <TabsTrigger value="visualize">{t('side_nav_visualizations')}</TabsTrigger>
            <TabsTrigger value="predict">{t('side_nav_predictive_analytics')}</TabsTrigger>
            <TabsTrigger value="reports">{t('reports_title')}</TabsTrigger>
            <TabsTrigger value="security">{t('security_title')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* System Integrity & Health Widget */}
              <Card className="lg:col-span-1">
                <CardHeader className="text-start">
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    {t('system_integrity')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-primary" />
                      <span className="text-sm">{t('model_load')}</span>
                    </div>
                    <Badge variant="secondary">14%</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-500" />
                      <span className="text-sm">{t('active_sessions')}</span>
                    </div>
                    <span className="font-bold text-sm">{t('active_count')}</span>
                  </div>
                  <div className="mt-4">
                    <SystemHealthChart />
                  </div>
                </CardContent>
              </Card>

              {/* Data Freshness Map Placeholder/Widget */}
              <Card className="lg:col-span-2">
                <CardHeader className="text-start">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    {t('data_freshness_map_title')}
                  </CardTitle>
                  <CardDescription>{t('data_freshness_map_desc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[120px] bg-muted/50 rounded-lg flex items-center justify-center relative overflow-hidden">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-green-500 animate-pulse" />
                        </div>
                        <span className="text-[10px] mt-1 text-muted-foreground">{t('city_ndjamena')}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-yellow-500" />
                        </div>
                        <span className="text-[10px] mt-1 text-muted-foreground">{t('city_kanem')}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-red-500" />
                        </div>
                        <span className="text-[10px] mt-1 text-muted-foreground">{t('city_tibesti')}</span>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> <span className="text-[8px]">{t('less_than_1y')}</span></div>
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> <span className="text-[8px]">{t('one_to_5y')}</span></div>
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> <span className="text-[8px]">{t('greater_than_5y')}</span></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="text-start">
                  <CardTitle>{t('recent_activity')}</CardTitle>
                  <CardDescription>{t('recent_actions')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { action: t('dataset_imported'), user: `${t('analyst_label')} 1`, time: `2 ${t('overview_hours_ago')}` },
                    { action: t('generate_report'), user: `Chercheur 3`, time: `3 ${t('overview_hours_ago')}` },
                    { action: t('predictive_analytics'), user: `${t('analyst_label')} 2`, time: `5 ${t('overview_hours_ago')}` },
                    { action: t('export_data'), user: `Chercheur 1`, time: `6 ${t('overview_hours_ago')}` },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="text-start">
                        <p className="font-medium">{item.action}</p>
                        <p className="text-muted-foreground">{item.user}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{item.time}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="text-start">
                  <CardTitle>{t('system_alerts')}</CardTitle>
                  <CardDescription>{t('recent_actions')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { type: "info", message: `${t('system_uptime_label')}: ${stats.server_uptime}` },
                    { type: "success", message: `${t('db_status_label')}: ${stats.database_status}` },
                    { type: "warning", message: `3 ${t('datasets_need_cleaning')}` },
                  ].map((alert, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <AlertCircle className={`w-4 h-4 mt-0.5 ${alert.type === 'warning' ? 'text-yellow-500' :
                        alert.type === 'info' ? 'text-blue-500' : 'text-green-500'
                        }`} />
                      <p className="text-sm text-start">{alert.message}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => navigate("/admin/users")}>
                <Users className="w-4 h-4 me-2" />
                {t('open_user_control_center')}
              </Button>
            </div>
            {/* We can potentially embed a simplified table here later */}
            <Card>
              <CardHeader className="text-start">
                <CardTitle>{t('user_control_center')}</CardTitle>
                <CardDescription>{t('manage_team_access')}</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center border-2 border-dashed rounded-lg">
                <div className="text-center space-y-4">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground max-w-xs">
                    {t('user_control_center_desc')}
                  </p>
                  <Button onClick={() => navigate("/admin/users")}>
                    {t('access_user_control')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <DataManagement />
          </TabsContent>

          <TabsContent value="visualize">
            <VisualizationDashboard />
          </TabsContent>

          <TabsContent value="predict">
            <PredictiveAnalytics />
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader className="text-start">
                <CardTitle>{t('reports')}</CardTitle>
                <CardDescription>{t('reports_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => navigate("/analyst/report")}>
                  <FileText className="w-6 h-6" />
                  {t('generate_report')}
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => navigate("/analyst/reports")}>
                  <CalendarCheck className="w-6 h-6" />
                  {t('reports_history')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <SecurityCenter />
          </TabsContent>
        </Tabs >
      </main >


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
                <h2 className="text-2xl font-bold tracking-wide m-0">DATAVISION TCHAD</h2>
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

    </div >
  );
};

export default Dashboard;
