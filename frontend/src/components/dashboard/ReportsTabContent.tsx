import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
    CheckCircle2,
    Clock,
    XCircle,
    Settings,
    Eye,
    Calendar,
    ShieldAlert,
    Search,
    FileText,
    Loader2,
    Download
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { downloadReport, getReportHistory, generateFilteredReport, previewReport } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface ReportHistoryItem {
    id: number;
    report_type: string;
    filters_applied: any;
    created_by: string;
    timestamp: string;
    filename?: string;
    status: 'ready' | 'processing' | 'expired';
    schedule?: string;
    parameters?: any;
}

export const ReportsTabContent = () => {
    const { t, isRtl, currentLang } = useLanguage();
    const { toast } = useToast();

    // Config state
    const [reportType, setReportType] = useState<string>("");
    const [auditType, setAuditType] = useState<string>("");
    const [dateRange, setDateRange] = useState<string>("");
    const [userRole, setUserRole] = useState<string>("");
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [scheduleFrequency, setScheduleFrequency] = useState<string>("");

    // UI state
    const [generating, setGenerating] = useState(false);
    const [history, setHistory] = useState<ReportHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [previewingId, setPreviewingId] = useState<number | null>(null);

    // ── Fetch history ────────────────────────────────────────────────────────
    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getReportHistory();
            setHistory(data || []);
        } catch (error: any) {
            console.error("Failed to fetch report history", error);
            toast({
                variant: "destructive",
                title: t('common_error'),
                description: t('reports_fetch_history_failed'),
            });
        } finally {
            setLoading(false);
        }
    }, [toast, t]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // ── Generate ─────────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!reportType) {
            toast({
                variant: "destructive",
                title: t('common_validation_error'),
                description: t('reports_select_type_error'),
            });
            return;
        }

        setGenerating(true);
        try {
            const response = await generateFilteredReport(
                reportType,
                auditType || 'all',
                dateRange || 'all_time',
                userRole || 'all_roles'
            );

            toast({ 
                title: t('reports_generated_success'), 
                description: t('reports_generated_success_desc') 
            });

            fetchHistory();

            const blob = response.data;
            if (blob) {
                const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
                const link = document.createElement('a');
                link.href = blobUrl;
                link.setAttribute('download', `DataVision_Report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
            }
        } catch (error: any) {
            console.error("Report generation failed", error);
            toast({
                variant: "destructive",
                title: t('reports_generation_failed'),
                description: t('reports_generation_error'),
            });
        } finally {
            setGenerating(false);
        }
    };

    const handlePreview = async (report: ReportHistoryItem) => {
        if (!report.filename) {
            toast({ variant: "destructive", title: t('common_error'), description: t('reports_file_not_found') });
            return;
        }
        setPreviewingId(report.id);
        try {
            await previewReport(report.filename);
        } catch {
            toast({ variant: "destructive", title: t('common_error'), description: t('reports_preview_failed') });
        } finally {
            setPreviewingId(null);
        }
    };

    const handleDownload = async (report: ReportHistoryItem) => {
        if (!report.filename) {
            toast({ variant: "destructive", title: t('common_error'), description: t('reports_file_not_found') });
            return;
        }
        setDownloadingId(report.id);
        try {
            const blob = await downloadReport(report.filename);
            const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', report.filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
        } catch {
            toast({ variant: "destructive", title: t('download_failed'), description: t('reports_download_failed') });
        } finally {
            setDownloadingId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ready':
                return (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 me-1" />
                        {t('status_ready')}
                    </Badge>
                );
            case 'processing':
                return (
                    <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">
                        <Loader2 className="w-3 h-3 me-1 animate-spin" />
                        {t('status_processing')}
                    </Badge>
                );
            case 'expired':
                return (
                    <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/30">
                        <XCircle className="w-3 h-3 me-1" />
                        {t('status_expired')}
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline">
                        <Clock className="w-3 h-3 me-1" />
                        {t('status_unknown')}
                    </Badge>
                );
        }
    };

    const filteredHistory = history.filter(r =>
        r.report_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.created_by?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.timestamp?.includes(searchQuery)
    );

    return (
        <div className="p-0 animate-in fade-in duration-500">
            <div className="grid lg:grid-cols-12 gap-6">
                {/* ── Configuration Form (col-span-4) ───────────────────────── */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="bg-white border-slate-200 shadow-xl backdrop-blur-sm">
                        <CardHeader className="text-start">
                            <CardTitle className="flex items-center gap-2 text-slate-900 italic">
                                <Settings className="w-5 h-5 text-primary" />
                                {t('reports_configuration')}
                            </CardTitle>
                            <CardDescription className="text-slate-500">
                                {t('reports_configuration_desc')}
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4 text-start">
                            <div className="space-y-2">
                                <Label htmlFor="report-type">{t('reports_type_label')}</Label>
                                <Select value={reportType} onValueChange={setReportType}>
                                    <SelectTrigger id="report-type" className="bg-slate-50 border-slate-200">
                                        <SelectValue placeholder={t('reports_select_type_placeholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="audit_logs">{t('reports_type_audit_logs_trace')}</SelectItem>
                                        <SelectItem value="user_statistics">{t('reports_type_user_stats_engagement')}</SelectItem>
                                        <SelectItem value="security_events">{t('reports_type_security_events_access')}</SelectItem>
                                        <SelectItem value="data_governance">{t('reports_type_data_gov_tracking')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="audit-type">{t('reports_audit_label')}</Label>
                                <Select value={auditType} onValueChange={setAuditType}>
                                    <SelectTrigger id="audit-type" className="bg-slate-50 border-slate-200">
                                        <SelectValue placeholder={t('reports_all_types')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t('reports_all_types')}</SelectItem>
                                        <SelectItem value="auth_events">{t('reports_audit_auth_events')}</SelectItem>
                                        <SelectItem value="data_operations">{t('reports_audit_data_operations')}</SelectItem>
                                        <SelectItem value="system_config">{t('reports_audit_system_config')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="date-range">{t('reports_date_range_label')}</Label>
                                <Select value={dateRange} onValueChange={setDateRange}>
                                    <SelectTrigger id="date-range" className="bg-slate-50 border-slate-200">
                                        <SelectValue placeholder={t('reports_select_range_placeholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="today">{t('reports_range_today')}</SelectItem>
                                        <SelectItem value="last_7_days">{t('reports_range_last_7_days')}</SelectItem>
                                        <SelectItem value="last_30_days">{t('reports_range_last_30_days')}</SelectItem>
                                        <SelectItem value="current_quarter">{t('reports_range_current_quarter')}</SelectItem>
                                        <SelectItem value="all_time">{t('reports_range_all_time')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="user-role">{t('reports_user_role_label')}</Label>
                                <Select value={userRole} onValueChange={setUserRole}>
                                    <SelectTrigger id="user-role" className="bg-slate-50 border-slate-200">
                                        <SelectValue placeholder={t('reports_all_roles')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all_roles">{t('reports_all_roles')}</SelectItem>
                                        <SelectItem value="admin">{t('role_admin')}</SelectItem>
                                        <SelectItem value="analyst">{t('role_analyst')}</SelectItem>
                                        <SelectItem value="researcher">{t('role_researcher')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <Button
                                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-11"
                                    onClick={handleGenerate}
                                    disabled={generating || !reportType}
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} />
                                            {t('reports_generating')}
                                        </>
                                    ) : (
                                        <>
                                            <FileText className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                                            {t('reports_generate_btn')}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── History Table (col-span-8) ────────────────────────────────── */}
                <div className="lg:col-span-8">
                    <Card className="bg-white border-slate-200 shadow-xl backdrop-blur-sm h-full">
                        <CardHeader className="text-start">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-slate-900 italic">{t('reports_history_title')}</CardTitle>
                                    <CardDescription className="text-slate-500">{t('reports_history_desc')}</CardDescription>
                                </div>
                                <div className="relative w-full md:w-64">
                                    <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400`} />
                                    <Input
                                        placeholder={t('reports_search_placeholder')}
                                        className={`${isRtl ? 'pr-10' : 'pl-10'} bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 h-9`}
                                        value={searchQuery}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent>
                            <ScrollArea className="w-full h-[540px]">
                                {loading ? (
                                    <div className="flex items-center justify-center py-20">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    </div>
                                ) : filteredHistory.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-slate-100 hover:bg-transparent uppercase text-[10px] tracking-widest text-slate-500">
                                                <TableHead className="text-start">{t('reports_table_date')}</TableHead>
                                                <TableHead className="text-start">{t('reports_table_type')}</TableHead>
                                                <TableHead className="text-start">{t('reports_table_created_by')}</TableHead>
                                                <TableHead className="text-start">{t('reports_table_status')}</TableHead>
                                                <TableHead className="text-start">{t('reports_table_actions')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredHistory.map((report) => (
                                                <TableRow key={report.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                    <TableCell className="font-medium text-slate-700 text-start py-4">
                                                        <div className="flex flex-col">
                                                            <span>{report.timestamp ? new Date(report.timestamp).toLocaleDateString(currentLang === 'ar' ? 'ar-SA' : currentLang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</span>
                                                            {report.timestamp && (
                                                                <span className="text-[10px] text-slate-400 mt-1">
                                                                    {new Date(report.timestamp).toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : currentLang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-slate-700 text-start">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold">
                                                                {(() => {
                                                                    const typeMap: Record<string, string> = {
                                                                        'audit_logs': 'reports_type_audit_logs_trace',
                                                                        'user_statistics': 'reports_type_user_stats_engagement',
                                                                        'security_events': 'reports_type_security_events_access',
                                                                        'data_governance': 'reports_type_data_gov_tracking',
                                                                        'Audit Logs': 'reports_type_audit_logs_trace',
                                                                        'User Statistics': 'reports_type_user_stats_engagement',
                                                                        'Security Violations': 'reports_type_security_events_access',
                                                                        'System Logs': 'reports_type_audit_logs_trace',
                                                                        'Database Growth': 'reports_type_data_gov_tracking',
                                                                    };
                                                                    const key = typeMap[report.report_type] || `reports_type_${report.report_type}`;
                                                                    return t(key, { defaultValue: report.report_type });
                                                                })()}
                                                            </span>
                                                            {report.schedule && (
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    <Calendar className="w-3 h-3 text-violet-500" />
                                                                    <span className="text-[10px] text-violet-500 uppercase tracking-wider font-bold">
                                                                        {t(`reports_schedule_${report.schedule.toLowerCase()}`, { defaultValue: report.schedule })}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-slate-500 text-start text-sm">
                                                        {report.created_by || 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="text-start">
                                                        {getStatusBadge(report.status)}
                                                    </TableCell>
                                                    <TableCell className="text-start">
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                                title={t('reports_preview_btn')}
                                                                onClick={() => handlePreview(report)}
                                                                disabled={previewingId === report.id || report.status !== 'ready'}
                                                            >
                                                                {previewingId === report.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Eye className="w-4 h-4" />
                                                                )}
                                                            </Button>

                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                                title={t('common_download')}
                                                                onClick={() => handleDownload(report)}
                                                                disabled={downloadingId === report.id || report.status !== 'ready'}
                                                            >
                                                                {downloadingId === report.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Download className="w-4 h-4" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="text-center py-20 text-slate-400">
                                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                        <p className="font-medium tracking-wide">{t('reports_no_history_found')}</p>
                                    </div>
                                )}
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};


export default ReportsTabContent;
