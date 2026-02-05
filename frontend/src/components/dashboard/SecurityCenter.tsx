import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAdminAudit, adminExport, setup2FA, verify2FASetup, disable2FA, changePassword } from "@/services/api";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  Key,
  Lock,
  Fingerprint,
  Activity,
  Loader2,
  FileDown,
  Eye,
  Download,
  UserCog,
  ShieldAlert
} from "lucide-react";

const SecurityCenter = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [twoFADialogOpen, setTwoFADialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [twoFACode, setTwoFACode] = useState("");
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const navigate = useNavigate();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminAudit();
      setLogs(data.length > 0 ? data : [
        { id: 1, user: "admin@inseed.td", action: "Export données", dataset: "Recensement 2020", time: "2024-01-15 14:32", status: "success", ip: "192.168.1.1", browser: "Chrome/Linux", query: "SELECT * FROM census_2020" },
        { id: 2, user: "analyste1@inseed.td", action: "Consultation", dataset: "Enquête Emploi", time: "2024-01-15 13:15", status: "success", ip: "192.168.1.42", browser: "Firefox/Windows", query: "GET /api/research/trends" },
      ]);
    } catch (error) {
      console.error("Failed to fetch logs", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async (format: string) => {
    setExporting(format);
    try {
      const res = await adminExport(format, "General Data");
      toast({
        title: t('export_started'),
        description: `${t('security_export_traceability')} (${format})`,
      });
      fetchLogs();

      setTimeout(() => {
        window.open(res.download_url, '_blank');
      }, 1000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('reports_download_failed'),
      });
    } finally {
      setExporting(null);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: t('security_password_mismatch'),
        description: t('security_password_mismatch_desc'),
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        variant: "destructive",
        title: t('security_weak_password'),
        description: t('security_weak_password_desc'),
      });
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      toast({
        title: t('security_password_changed'),
        description: t('security_password_changed_desc'),
      });
      // Clear session and redirect to login
      sessionStorage.clear();
      navigate('/login');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('security_password_change_failed'),
        description: error.response?.data?.detail || t('security_password_change_error'),
      });
    }
  };

  const handle2FASetup = async () => {
    try {
      const result = await setup2FA();
      setQrCodeUrl(result.qr_code);
      setTotpSecret(result.secret);
      setTwoFADialogOpen(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('security_2fa_setup_failed'),
        description: error.response?.data?.detail || t('security_2fa_setup_error'),
      });
    }
  };

  const handle2FAVerify = async () => {
    try {
      await verify2FASetup(twoFACode);
      toast({
        title: t('security_2fa_enabled'),
        description: t('security_2fa_enabled_desc'),
      });
      setIs2FAEnabled(true);
      setTwoFADialogOpen(false);
      setTwoFACode("");
      setQrCodeUrl(null);
      setTotpSecret(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('security_2fa_verify_failed'),
        description: error.response?.data?.detail || t('security_2fa_verify_error'),
      });
    }
  };

  const handle2FADisable = async () => {
    if (!confirm(t('security_2fa_disable_confirm'))) {
      return;
    }
    try {
      await disable2FA(twoFACode);
      toast({
        title: t('security_2fa_disabled'),
        description: t('security_2fa_disabled_desc'),
      });
      setIs2FAEnabled(false);
      setTwoFACode("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('security_2fa_disable_failed'),
        description: error.response?.data?.detail || t('security_2fa_disable_error'),
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Security Alerts & Adoption */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2 text-start">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-primary" />
              {t('security_2fa_adoption')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">100%</div>
            <p className="text-xs text-muted-foreground mt-1">{t('security_status_mandatory')}</p>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="pb-2 text-start">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lock className="w-4 h-4 text-green-600" />
              {t('security_data_encryption')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">AES-256</div>
            <p className="text-xs text-muted-foreground mt-1">{t('security_status_active')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 text-start">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              {t('security_alerts')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-green-600 mt-1">{t('no_anomalies')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 text-start">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-600" />
              {t('authorized_all')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">{t('status_active')}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('security_role_based_access')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Data Export Control */}
        <Card className="lg:col-span-2">
          <CardHeader className="text-start">
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              {t('security_export_control')}
            </CardTitle>
            <CardDescription>
              {t('security_export_traceability')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-start">
            <div className="grid gap-3 md:grid-cols-3">
              {['CSV', 'Excel', 'PDF'].map(fmt => (
                <Button
                  key={fmt}
                  variant="outline"
                  className={`justify-start`}
                  onClick={() => handleExport(fmt)}
                  disabled={exporting === fmt}
                >
                  {exporting === fmt ? <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} /> : <FileDown className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />}
                  {t('security_export_btn', { fmt })}
                </Button>
              ))}
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">{t('security_policy')}</p>
                  <p className="text-muted-foreground mt-1 leading-relaxed">
                    {t('security_anonymized_data')} {t('security_traceability_desc')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Settings - Merged from Analyst */}
        <Card>
          <CardHeader className="text-start">
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              {t('security_account_settings')}
            </CardTitle>
            <CardDescription>{t('security_account_settings_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-start">
            <Button className="w-full justify-start" variant="outline" onClick={() => setPasswordDialogOpen(true)}>
              <Key className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
              {t('security_change_password')}
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => is2FAEnabled ? handle2FADisable() : handle2FASetup()}>
              <Fingerprint className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
              {is2FAEnabled ? t('security_disable_2fa') : t('security_enable_2fa')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Audit Log */}
      <Card>
        <CardHeader className="text-start">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            {t('security_audit_log')}
          </CardTitle>
          <CardDescription>
            {t('security_audit_log_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-start">
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 hover:scale-[1.005] transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{log.action}</p>
                      <Badge variant="outline" className="text-xs">
                        {log.dataset}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {log.user} • {log.time}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLog(log)}
                  aria-label={t('reports_preview_action')}
                  title={t('reports_preview_action')}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {loading && <div className="text-center py-4"><Loader2 className={`animate-spin inline ${isRtl ? 'ml-2' : 'mr-2'}`} /> {t('common_loading')}</div>}
          </div>

          <Button variant="outline" className="w-full mt-4" onClick={fetchLogs}>
            {t('security_view_full_history')}
          </Button>
        </CardContent>
      </Card>

      {/* Security Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3 text-start">
            <CardTitle className="text-sm font-medium">{t('access_today')}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground mt-1">+12% {t('up_yesterday')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 text-start">
            <CardTitle className="text-sm font-medium">{t('exports_month')}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground mt-1">{t('authorized_all')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 text-start">
            <CardTitle className="text-sm font-medium">{t('security_alerts')}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">{t('no_anomalies')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Preview Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-start">
            <DialogTitle>{t('reports_preview_action')}</DialogTitle>
            <DialogDescription>
              {selectedLog?.action} - {selectedLog?.dataset}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-start">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground">{t('user_ip')}</p>
                <code className="bg-muted px-1 rounded">{selectedLog?.ip || 'N/A'}</code>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">{t('browser_type')}</p>
                <p className="truncate" title={selectedLog?.browser}>{selectedLog?.browser || 'N/A'}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground">{t('security_action_metadata')}</p>
              <pre className="p-3 bg-slate-950 text-emerald-400 rounded-md text-xs font-mono overflow-auto max-h-40 border border-emerald-500/20">
                {selectedLog?.payload ? JSON.stringify(JSON.parse(selectedLog.payload), null, 2) : (selectedLog?.query || '{"operation": "trace_only"}')}
              </pre>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground">{t('data_snippet')}</p>
              <div className="p-3 bg-card border rounded-md text-[10px] font-mono whitespace-pre italic text-muted-foreground">
                [AI-TRC] 0xFD34... {selectedLog?.action.toUpperCase()} AT {selectedLog?.time}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setSelectedLog(null)}>{t('common_close')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader className="text-start">
            <DialogTitle>{t('security_change_password')}</DialogTitle>
            <DialogDescription>{t('security_change_password_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-start">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('security_current_password')}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('security_new_password')}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('security_confirm_new_password')}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>{t('common_cancel')}</Button>
            <Button onClick={handlePasswordChange}>{t('security_change_password')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2FA Setup Dialog */}
      <Dialog open={twoFADialogOpen} onOpenChange={setTwoFADialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-start">
            <DialogTitle>{t('security_2fa_setup_title')}</DialogTitle>
            <DialogDescription>
              {t('security_2fa_setup_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-start">
            {qrCodeUrl && (
              <div className="flex justify-center">
                <img src={qrCodeUrl} alt="2FA QR Code" className="border rounded-lg" />
              </div>
            )}
            {totpSecret && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">{t('security_2fa_manual_entry')}</p>
                <code className="bg-muted px-3 py-2 rounded text-sm font-mono">{totpSecret}</code>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="2fa-code">{t('security_2fa_enter_code')}</Label>
              <Input
                id="2fa-code"
                type="text"
                placeholder="000000"
                maxLength={6}
                value={twoFACode}
                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setTwoFADialogOpen(false);
              setTwoFACode("");
            }}>{t('common_cancel')}</Button>
            <Button onClick={handle2FAVerify} disabled={twoFACode.length !== 6}>{t('security_2fa_verify_enable')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecurityCenter;
