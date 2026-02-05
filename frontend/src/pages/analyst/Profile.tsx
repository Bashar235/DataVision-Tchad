import React, { useState, useEffect } from "react";
import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Activity, Loader2, Check, CheckCircle2, ListTodo, AlertTriangle, Info } from "lucide-react";
import ContactSupportDialog from "@/components/ContactSupportDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { updateCurrentUserProfile } from "@/services/api";

const Profile = () => {
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();
  const { user, refreshUser } = useAuth();

  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    role: "Analyst",
    department: "Data Processing"
  });

  const [supportOpen, setSupportOpen] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  // Hydrate user data
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
          description: t('profile_update_error')
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const mainPadding = isRtl ? 'pr-[80px]' : 'pl-[80px]';

  return (
    <div className="min-h-screen bg-background">
      <AnalystSidebar />

      <main className={`${mainPadding} p-8 overflow-auto transition-all duration-300`}>
        <div className="max-w-6xl mx-auto space-y-8 pb-12">

          {/* Header */}
          <div className="text-start">
            <h1 className="text-4xl font-extrabold mb-3 text-slate-950 tracking-tight">{t('profile_settings_title')}</h1>
            <p className="text-slate-700 text-lg">{t('profile_settings_subtitle')}</p>
          </div>

          <div className={`grid gap-8 lg:grid-cols-3 ${isRtl ? 'lg:flex-row-reverse' : ''}`}>

            {/* Left Column: Personal Info */}
            <div className="lg:col-span-2 space-y-8">
              <Card className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden p-2">
                <CardHeader className="text-start pb-2">
                  <CardTitle className="text-2xl font-bold text-slate-950">{t('profile_personal_info')}</CardTitle>
                  <CardDescription className="text-slate-700">{t('profile_personal_info_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">

                  {/* User Avatar & Name */}
                  <div className={`flex items-center gap-6 mb-8 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <User className="h-12 w-12 text-white" />
                    </div>
                    <div className="text-start">
                      <h3 className="text-2xl font-bold text-slate-950">{user?.full_name || profile.name}</h3>
                      <Badge className="mt-2 bg-emerald-50 text-emerald-600 border-none text-xs px-3 py-1 uppercase font-bold tracking-wide">
                        {user?.role || profile.role}
                      </Badge>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-semibold text-slate-950 ml-1">{t('profile_full_name')}</Label>
                      <Input
                        id="name"
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        className="h-12 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold text-slate-950 ml-1">{t('profile_email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        className="h-12 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="department" className="text-sm font-semibold text-slate-400 ml-1">{t('profile_department')} (Locked)</Label>
                      <Input id="department" value={profile.department} className="h-12 rounded-xl bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed" disabled />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="institution" className="text-sm font-semibold text-slate-400 ml-1">{t('profile_institution')} (Locked)</Label>
                      <Input id="institution" value="INSEED - Chad" className="h-12 rounded-xl bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed" disabled />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className={`flex gap-3 pt-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <Button onClick={handleSave} disabled={saving} className="h-12 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all active:scale-95 shadow-lg shadow-emerald-600/20">
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {t('profile_save_changes')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Stats & Security */}
            <div className="space-y-6">

              {/* Quick Stats Widget */}
              <Card className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden p-2">
                <CardHeader className="text-start pb-2">
                  <CardTitle className="text-xl font-bold text-slate-950">{t('profile_account_stats')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">

                  {/* Total Records Validated */}
                  <div className={`flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <div className="bg-white p-2 rounded-lg shadow-sm text-emerald-600">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{t('stats_total_validated')}</span>
                    </div>
                    <span className="text-xl font-black text-emerald-600">1,247</span>
                  </div>

                  {/* Pending Tasks */}
                  <div className={`flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <div className="bg-white p-2 rounded-lg shadow-sm text-amber-500">
                        <ListTodo className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{t('stats_pending_tasks')}</span>
                    </div>
                    <span className="text-xl font-black text-amber-500">3</span>
                  </div>

                </CardContent>
              </Card>

              {/* Account Security (Read Only) */}
              <Card className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden p-2">
                <CardHeader className="text-start pb-2">
                  <CardTitle className="text-xl font-bold text-slate-950">{t('profile_account_security')}</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className={`flex items-center gap-3 p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-blue-700 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></div>
                    <span className="text-sm font-medium">Password last changed 30 days ago</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden p-2">
                <CardHeader className="text-start pb-2">
                  <CardTitle className="text-xl font-bold text-slate-950">{t('support_help')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  <Button
                    variant="outline"
                    className="w-full h-11 justify-start gap-3 border-slate-200 text-slate-700 font-medium hover:bg-slate-50 hover:text-primary transition-all"
                    onClick={() => {
                      setSupportOpen(true);
                      setIsUrgent(false);
                    }}
                  >
                    <Mail className="h-4 w-4" />
                    {t('support_contact')}
                  </Button>

                  <div className="flex items-center gap-2 w-full">
                    <Button
                      variant="ghost"
                      className="flex-1 h-11 justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all group"
                      onClick={() => {
                        setSupportOpen(true);
                        setIsUrgent(true);
                      }}
                    >
                      <AlertTriangle className="h-4 w-4 group-hover:animate-pulse" />
                      {t('support_report_data_issue')}
                    </Button>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-2 text-slate-400 hover:text-slate-600 cursor-help transition-colors">
                            <Info className="h-4 w-4" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px] bg-slate-900 border-none text-white p-3 shadow-xl">
                          <p className="text-xs font-medium leading-relaxed">
                            Use <strong>ONLY</strong> for critical data errors or census ingestion failures. This flags the Admin immediately.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </main>

      {/* Support Dialog */}
      <ContactSupportDialog
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        isUrgent={isUrgent}
        defaultSubject={isUrgent ? t('support_data_issue_subject') : ''}
      />
    </div>
  );
};

export default Profile;
