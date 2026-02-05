import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Activity, Download, Loader2, Bell, Check, Trash2, Calendar, Edit, Archive } from "lucide-react";
import { getNotifications, deleteNotification, markNotificationRead, getScheduledExports, deleteScheduledExport, updateScheduledExport, downloadScheduledExport } from "@/services/api";
import ScheduleDialog from "@/components/ScheduleDialog";
import ContactSupportDialog from "@/components/ContactSupportDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { updateCurrentUserProfile } from "@/services/api";

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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [scheduledExports, setScheduledExports] = useState<any[]>([]);
  const [fetchingNotifications, setFetchingNotifications] = useState(false);
  const [fetchingSchedules, setFetchingSchedules] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchMyActivity();
    fetchNotifications();
    fetchSchedules();

    // Set up polling every 10 seconds
    const interval = setInterval(() => {
      fetchNotifications();
      fetchSchedules();
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

  const fetchSchedules = async () => {
    setFetchingSchedules(true);
    try {
      const data = await getScheduledExports();
      setScheduledExports(data);
    } catch (error) {
      console.error("Failed to fetch schedules");
    } finally {
      setFetchingSchedules(false);
    }
  };

  const handleCancelSchedule = async (id: number) => {
    try {
      await deleteScheduledExport(id);
      setScheduledExports(scheduledExports.filter(s => s.id !== id));
      toast({ title: t('schedule_cancelled_title') || "Schedule cancelled" });
    } catch (error) {
      toast({ title: t('error'), variant: "destructive" });
    }
  };

  const handleEditClick = (schedule: any) => {
    setSelectedSchedule(schedule);
    setIsEditDialogOpen(true);
  };

  const handleConfirmEdit = async (formData: { scheduledTime: string; details: string }) => {
    if (!selectedSchedule) return;
    try {
      await updateScheduledExport(selectedSchedule.id, formData.scheduledTime, formData.details);
      toast({
        title: t('schedule_updated_title') || "Schedule Updated",
        description: t('schedule_updated_desc') || "Your changes have been saved."
      });
      // Immediate Refresh
      fetchSchedules();
      fetchNotifications();
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Failed to update schedule", error);
      toast({ title: t('error'), description: t('error_update_schedule'), variant: "destructive" });
    }
  };

  const fetchNotifications = async () => {
    setFetchingNotifications(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications");
    } finally {
      setFetchingNotifications(false);
    }
  };

  const handleDismiss = async (id: number) => {
    try {
      await deleteNotification(id);
      setNotifications(notifications.filter(n => n.id !== id));
      toast({ title: t('notification_dismissed') || "Notification dismissed" });
    } catch (error) {
      toast({ title: t('error'), variant: "destructive" });
    }
  };

  const handleAcceptExport = async (notification: any) => {
    try {
      const blob = await downloadScheduledExport(notification.id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', notification.details?.filename || "export.xlsx");
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);

      // Archive immediately
      await markNotificationRead(notification.id);
      setNotifications(notifications.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
      toast({ title: t('export_downloaded_success') || "Export downloaded and archived successfully" });

      // Refresh to ensure archived state is reflected
      fetchNotifications();
    } catch (error) {
      console.error("Download failed", error);
      toast({ title: t('error'), description: t('error_download_export'), variant: "destructive" });
    }
  };

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

          <Card className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden p-2 border-l-4 border-l-amber-500">
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
              {fetchingSchedules ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
              ) : scheduledExports.length === 0 ? (
                <div className="text-center py-10 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="bg-white h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Archive className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium italic">{t('no_pending_exports') || 'No pending exports'}</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {scheduledExports.map((s) => (
                    <div key={s.id} className="p-5 border border-slate-100 rounded-2xl bg-white transition-all hover:shadow-lg hover:border-amber-200 group">
                      <div className="flex justify-between items-center gap-4">
                        <div className="text-start">
                          <p className="font-bold text-slate-950 text-lg mb-1">{s.export_details}</p>
                          <p className="text-sm text-slate-700 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            {t('target_label')}: <span className="text-amber-600 font-bold">{new Date(s.scheduled_time).toLocaleString()}</span>
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-xl hover:bg-amber-50 hover:text-amber-600 transition-all"
                            onClick={() => handleEditClick(s)}
                          >
                            <Edit className="h-5 w-5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all"
                            onClick={() => handleCancelSchedule(s.id)}
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

          <Card className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden p-2 border-l-4 border-l-blue-500">
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
              {fetchingNotifications ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-10 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="bg-white h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Bell className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium italic">{t('all_caught_up')}</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {notifications.map((n) => (
                    <div key={n.id} className={`p-6 border rounded-2xl transition-all ${n.is_read ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-blue-100 shadow-md ring-1 ring-blue-500/5'}`}>
                      <div className="flex justify-between items-start gap-4">
                        <div className="text-start flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {n.type === 'EXPORT_READY' && <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[10px] uppercase font-bold px-2 py-0.5">{t('export_ready') || 'Export Ready'}</Badge>}
                            {!n.is_read && <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />}
                          </div>
                          <p className={`font-bold text-slate-950 text-lg mb-2 ${n.is_read ? 'text-slate-600 font-semibold' : ''}`}>{n.message}</p>
                          <p className="text-sm text-slate-700 flex items-center gap-2 mb-4">
                            <Activity className="h-3.5 w-3.5 text-slate-400" />
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                          {n.type === 'EXPORT_READY' && !n.is_read && (
                            <div className="flex gap-3">
                              <Button size="sm" className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all active:scale-95" onClick={() => handleAcceptExport(n)}>
                                <Download className="h-4 w-4 mr-2" />
                                {t('accept') || 'Accept & Download'}
                              </Button>
                              <Button size="sm" variant="outline" className="h-10 px-6 rounded-xl border-slate-200 text-slate-700 font-semibold hover:bg-slate-50" onClick={() => handleDismiss(n.id)}>
                                {t('dismiss') || 'Dismiss'}
                              </Button>
                            </div>
                          )}
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
      <ScheduleDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onConfirm={handleConfirmEdit}
        mode="edit"
        initialData={selectedSchedule ? {
          scheduled_time: selectedSchedule.scheduled_time,
          details: selectedSchedule.export_details
        } : undefined}
      />
      <ContactSupportDialog
        isOpen={isContactDialogOpen}
        onClose={() => setIsContactDialogOpen(false)}
      />
    </div>
  );
};

export default Profile;
