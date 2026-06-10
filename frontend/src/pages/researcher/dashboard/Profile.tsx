import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Activity, Download, Loader2, Bell, Trash2, Calendar, Archive, AlertCircle, CheckCircle } from "lucide-react";
import { getResearcherPendingTasks, deleteResearcherTask, downloadResearcherTask } from "@/services/api";
import ContactSupportDialog from "@/components/ContactSupportDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { updateCurrentUserProfile } from "@/services/api";

const EXPORT_EXTENSIONS: Record<string, string> = {
  csv: "csv",
  excel: "xlsx",
  xlsx: "xlsx",
  json: "json",
};

const EXPORT_MIME_TYPES: Record<string, string> = {
  csv: "text/csv",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  json: "application/json",
};

const filenameForExport = (task: any, serverFilename?: string) => {
  const format = String(task.format || "csv").toLowerCase();
  const ext = EXPORT_EXTENSIONS[format] || "csv";
  const base = serverFilename || task.custom_filename || `export_${task.id}`;
  return String(base).replace(/\.(csv|xlsx|json)$/i, `.${ext}`);
};

const Profile = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    department: "Demographic Research",
    institution: "INSEED - Chad",
    role: "Researcher"
  });

  // Update local state when user data is available
  useEffect(() => {
    if (user) {
      setProfile(prev => ({
        ...prev,
        name: user.full_name,
        email: user.email,
        role: user.role
      }));
    }
  }, [user]);

  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [fetchingTasks, setFetchingTasks] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchMyActivity();
    fetchAllTasks();

    // Set up polling every 10 seconds
    const interval = setInterval(() => {
      fetchAllTasks();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchProfile = async () => {
    setLoading(false);
  };

  const fetchMyActivity = async () => {
    try {
      const logs = [
        { action: "EXPORT", detail: "Indicators Data (CSV)", time: `2 ${t('overview_hours_ago')}` },
        { action: "REPORT", detail: "Annual Population Study", time: `5 ${t('overview_hours_ago')}` },
        { action: "DATA_VIEW", detail: "Fertility Trends Map", time: `1 ${t('overview_day_ago')}` },
        { action: "MODEL_RUN", detail: "Baseline Forecast 2040", time: `2 ${t('overview_days_ago')}` },
        { action: "LOGIN", detail: "Platform Access", time: `3 ${t('overview_days_ago')}` },
      ];
      setActivityLogs(logs);
    } catch (e) {
      console.error("Failed to fetch activity logs");
    }
  };

  const fetchAllTasks = async () => {
    setFetchingTasks(true);
    try {
      const data = await getResearcherPendingTasks();
      setAllTasks(data);
    } catch (error) {
      console.error("Failed to fetch researcher tasks");
    } finally {
      setFetchingTasks(false);
    }
  };

  const handleCancelTask = async (id: number) => {
    try {
      await deleteResearcherTask(id);
      setAllTasks(prev => prev.filter(t => t.id !== id));
      toast({ title: t('schedule_cancelled_title') || "Task cancelled" });
    } catch (error) {
      toast({ title: t('error'), variant: "destructive" });
    }
  };

  const handleDismissAlert = async (id: number) => {
    try {
      await deleteResearcherTask(id);
      setAllTasks(prev => prev.filter(t => t.id !== id));
      toast({ title: t('notification_dismissed') || "Dismissed" });
    } catch (error) {
      toast({ title: t('error'), variant: "destructive" });
    }
  };

  const handleDownloadExport = async (task: any) => {
    try {
      const download = await downloadResearcherTask(task.id);
      const format = String(task.format || "csv").toLowerCase();
      const blob = new Blob([download.blob], { type: download.contentType || EXPORT_MIME_TYPES[format] || "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filenameForExport(task, download.filename));
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({ title: t('export_downloaded_success') || "Export downloaded successfully" });
      fetchAllTasks();
    } catch (error) {
      console.error("Download failed", error);
      toast({ title: t('error'), description: t('error_download_export'), variant: "destructive" });
    }
  };

  const startOfLocalDay = (date: Date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const todayStart = useMemo(() => startOfLocalDay(new Date()), []);

  const getTargetDay = (targetDate?: string) => {
    if (!targetDate) return null;
    return startOfLocalDay(new Date(targetDate));
  };

  // Lifecycle filtering
  // Pending Requests: future scheduled dates.
  // Notifications: D-Day alerts and completed exports whose target date has arrived.

  const pendingTasks = useMemo(() => {
    return allTasks.filter(task => {
      const targetDay = getTargetDay(task.target_date);
      return Boolean(targetDay && targetDay > todayStart);
    });
  }, [allTasks, todayStart]);

  const alertCards = useMemo(() => {
    return allTasks
      .filter(task => {
        const targetDay = getTargetDay(task.target_date);
        if (!targetDay || targetDay > todayStart) return false;

        const status = String(task.status || "").toUpperCase();
        return targetDay.getTime() === todayStart.getTime() || status === 'COMPLETED';
      })
      .map(task => {
        const status = String(task.status || "").toUpperCase();
        const isCompleted = status === 'COMPLETED';

        return {
          id: task.id,
          type: isCompleted ? 'EXPORT_READY' as const : 'DDAY_DEADLINE' as const,
          title: isCompleted ? (t('export_ready') || 'Export Ready') : (t('dday_alert') || 'D-Day Alert'),
          message: isCompleted
            ? `${t('export_ready_msg') || 'Your export'} '${task.custom_filename || task.task_name}' ${t('is_ready_download') || 'is ready for download.'}`
            : `${t('export_label') || 'Export'} '${task.custom_filename || task.task_name}' ${t('due_today') || 'is due today'}.`,
          timestamp: task.completed_at || task.target_date || task.created_at,
          priority: 'high' as const,
          task,
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allTasks, todayStart, t]);

  const handleSave = async () => {
    if (!profile.name || !profile.email) {
      toast({ variant: "destructive", title: t('common_error'), description: t('all_fields_mandatory') || "All fields are required" });
      return;
    }

    setSaving(true);
    try {
      await updateCurrentUserProfile({
        full_name: profile.name,
        email: profile.email
      });

      // Refresh global auth state to reflect changes immediately
      await refreshUser();

      toast({
        title: t('success'),
        description: t('success_profile_updated')
      });
    } catch (error: any) {
      console.error("Failed to update profile", error);
      if (error.response?.status === 409) {
        toast({
          variant: "destructive",
          title: t('common_error'),
          description: t('error_email_exists')
        });
      } else {
        toast({
          variant: "destructive",
          title: t('common_error'),
          description: t('common_error_desc') || "Failed to update profile"
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="text-start">
        <h1 className="text-4xl font-extrabold mb-3 text-slate-950 tracking-tight">{t('profile_settings_title')}</h1>
        <p className="text-slate-700 text-lg">{t('profile_settings_subtitle')}</p>
      </div>

      <div className={`grid gap-8 lg:grid-cols-3 ${isRtl ? 'lg:flex-row-reverse' : ''}`}>
        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden p-2">
            <CardHeader className="text-start pb-2">
              <CardTitle className="text-2xl font-bold text-slate-950">{t('profile_personal_info')}</CardTitle>
              <CardDescription className="text-slate-700">{t('profile_personal_info_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className={`flex items-center gap-6 mb-8 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/20">
                  <User className="h-12 w-12 text-white" />
                </div>
                <div className="text-start">
                  <h3 className="text-2xl font-bold text-slate-950">{user?.full_name || profile.name}</h3>
                  <Badge className="mt-2 bg-primary/10 text-primary border-none text-xs px-3 py-1 uppercase">{user?.role || profile.role}</Badge>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-slate-950 ml-1">{t('profile_full_name')}</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="h-12 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-950 ml-1">{t('profile_email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="h-12 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department" className="text-sm font-semibold text-slate-400 ml-1">{t('profile_department')} (Locked)</Label>
                  <Input id="department" value={profile.department} className="h-12 rounded-xl bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed" disabled />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="institution" className="text-sm font-semibold text-slate-400 ml-1">{t('profile_institution')} (Locked)</Label>
                  <Input id="institution" value={profile.institution} className="h-12 rounded-xl bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed" disabled />
                </div>
              </div>

              <div className={`flex gap-3 pt-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <Button onClick={handleSave} disabled={saving} className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition-all active:scale-95 shadow-lg shadow-primary/20">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {t('profile_save_changes')}
                </Button>
                <Button variant="outline" onClick={() => fetchProfile()} className="h-12 px-8 rounded-xl border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-all">{t('profile_cancel')}</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 dark:border-gray-800 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-2xl overflow-hidden p-2">
            <CardHeader className="text-start pb-2">
              <CardTitle className="text-2xl font-bold text-slate-950 flex items-center gap-3">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <Calendar className="h-5 w-5 text-amber-600" />
                </div>
                {t('pending_requests') || 'Pending Requests'}
              </CardTitle>
              <CardDescription className="text-slate-700 ml-10">{t('pending_requests_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {fetchingTasks ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
              ) : pendingTasks.length === 0 ? (
                <div className="text-center py-10 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="bg-white h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Archive className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium italic">{t('no_pending_exports') || 'No pending exports'}</p>
                </div>
              ) : (
                <div
                  className="grid max-h-[320px] gap-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200"
                  style={{
                    maskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
                  }}
                >
                  {pendingTasks.map((task) => (
                    <div key={task.id} className="p-5 border border-gray-100 dark:border-gray-800 rounded-2xl bg-white transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] group">
                      <div className="flex justify-between items-center gap-4">
                        <div className="text-start">
                          <p className="font-bold text-slate-950 text-lg mb-1">{task.custom_filename || task.task_name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <Badge variant="outline" className="gap-1.5 text-[10px] uppercase font-medium px-2 py-0.5 border-amber-100 bg-amber-50 text-amber-700">
                              <Calendar className="h-3 w-3" />
                              {t('scheduled') || 'Scheduled'}
                            </Badge>
                            <span className="text-xs text-slate-500 uppercase font-medium">{task.format}</span>
                          </div>
                          <p className="text-sm text-slate-700 flex items-center gap-2 mt-2">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            {t('target_label') || 'Target'}: <span className="text-slate-500 font-normal">{task.target_date ? new Date(task.target_date).toLocaleDateString() : '-'}</span>
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all"
                            onClick={() => handleCancelTask(task.id)}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 dark:border-gray-800 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-2xl overflow-hidden p-2">
            <CardHeader className="text-start pb-2">
              <CardTitle className="text-2xl font-bold text-slate-950 flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                {t('notifications') || 'Notifications'}
              </CardTitle>
              <CardDescription className="text-slate-700 ml-10">{t('notifications_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {fetchingTasks ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
              ) : alertCards.length === 0 ? (
                <div className="text-center py-10 px-6 bg-slate-50/70 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="bg-white h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <CheckCircle className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-normal">{t('all_caught_up')}</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {alertCards.map((alert) => (
                    <div key={alert.id} className={`p-6 border rounded-2xl transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] border-gray-100 dark:border-gray-800 ${alert.type === 'EXPORT_READY' ? 'bg-white' : 'bg-amber-50/50'}`}>
                      <div className="flex justify-between items-start gap-4">
                        <div className="text-start flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {alert.type === 'EXPORT_READY' ? (
                              <Badge variant="outline" className="gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] uppercase font-medium px-2 py-0.5">
                                <CheckCircle className="h-3 w-3" />
                                {t('export_ready') || 'Export Ready'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1.5 bg-amber-50 text-amber-700 border-amber-100 text-[10px] uppercase font-medium px-2 py-0.5">
                                <AlertCircle className="h-3 w-3" />
                                {t('dday_alert') || 'D-Day Alert'}
                              </Badge>
                            )}
                            <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                          </div>
                          <p className="font-bold text-slate-950 text-lg mb-2">{alert.message}</p>
                          <p className="text-sm text-slate-700 flex items-center gap-2 mb-4">
                            <Activity className="h-3.5 w-3.5 text-slate-400" />
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                          <div className="flex gap-3">
                            {alert.type === 'EXPORT_READY' ? (
                              <Button size="sm" className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all active:scale-95 shadow-sm shadow-blue-600/20" onClick={() => handleDownloadExport(alert.task)}>
                                <Download className="h-4 w-4 mr-2" />
                                {t('accept') || 'Accept & Download'}
                              </Button>
                            ) : (
                              <Button size="sm" className="h-10 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-all active:scale-95" disabled>
                                <AlertCircle className="h-4 w-4 mr-2" />
                                {t('processing') || 'Processing...'}
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => handleDismissAlert(alert.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden p-2">
            <CardHeader className="text-start pb-2">
              <CardTitle className="text-2xl font-bold text-slate-950">{t('profile_recent_activity')}</CardTitle>
              <CardDescription className="text-slate-700">{t('profile_usage_history')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {activityLogs.map((log, index) => (
                  <div key={index} className={`flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 border border-slate-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                      <Activity className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className={`flex-1 text-start`}>
                      <p className="font-bold text-slate-950 text-sm mb-0.5">{log.action}</p>
                      <p className="text-xs text-slate-600">{log.detail}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-400 whitespace-nowrap">{log.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden p-2">
            <CardHeader className="text-start">
              <CardTitle className="text-xl font-bold text-slate-950">{t('profile_account_stats')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">
              <div className={`flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className="bg-white p-1.5 rounded-lg shadow-sm">
                    <Download className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{t('export_data_button')}</span>
                </div>
                <span className="text-lg font-extrabold text-blue-600">127</span>
              </div>

              <div className={`flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className="bg-white p-1.5 rounded-lg shadow-sm">
                    <Activity className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{t('reports_total_reports')}</span>
                </div>
                <span className="text-lg font-extrabold text-emerald-600">45</span>
              </div>

              <div className={`flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className="bg-white p-1.5 rounded-lg shadow-sm">
                    <User className="h-4 w-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{t('profile_member_since')}</span>
                </div>
                <span className="text-sm font-bold text-slate-600 italic">Jan 2023</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden p-2">
            <CardHeader className="text-start">
              <CardTitle className="text-xl font-bold text-slate-950">{t('profile_access_permissions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {[
                { label: t('side_nav_visualizations'), status: 'success' },
                { label: t('side_nav_predictive_analytics'), status: 'success' },
                { label: t('reports_generate_new'), status: 'success' },
                { label: t('export_data_button'), status: 'success' },
                { label: t('admin_panel'), status: 'locked' }
              ].map((perm, idx) => (
                <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${perm.status === 'locked' ? 'bg-slate-50 border-slate-100' : 'bg-emerald-50/30 border-emerald-100'} ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <span className={`text-sm font-medium ${perm.status === 'locked' ? 'text-slate-400' : 'text-slate-900'}`}>{perm.label}</span>
                  <div className={`h-2.5 w-2.5 rounded-full ${perm.status === 'locked' ? 'bg-slate-300' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-indigo-600/5 border border-primary/10 rounded-2xl overflow-hidden">
            <CardContent className="pt-8">
              <div className={`flex flex-col items-center text-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center shadow-md">
                  <Mail className="h-7 w-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-950 mb-1">{t('profile_need_help')}</p>
                  <p className="text-sm text-slate-700 mb-6 leading-relaxed px-4">
                    {t('profile_contact_admin')}
                  </p>
                  <Button
                    variant="default"
                    onClick={() => setIsContactDialogOpen(true)}
                    className="w-full h-12 rounded-xl font-bold bg-white text-primary border border-primary/20 hover:bg-slate-50 shadow-sm transition-all"
                  >
                    {t('profile_contact_support')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ContactSupportDialog
        isOpen={isContactDialogOpen}
        onClose={() => setIsContactDialogOpen(false)}
      />
    </div>
  );
};

export default Profile;
