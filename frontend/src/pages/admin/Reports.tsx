import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
    FileText,
    Download,
    Loader2,
    Search,
    CheckCircle2,
    Clock,
    XCircle,
    Settings
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import api, { downloadReport, getReportHistory, generateFilteredReport } from "@/services/api";

interface ReportHistoryItem {
    id: number;
    report_type: string;
    filters_applied: any;
    created_by: string;
    timestamp: string;
    filename?: string;
    status: 'ready' | 'processing' | 'expired';
    parameters?: any;
}

const Reports = () => {
    const { t, isRtl } = useLanguage();
    const { toast } = useToast();
    const [reportType, setReportType] = useState<string>("");
    const [auditType, setAuditType] = useState<string>("");
    const [dateRange, setDateRange] = useState<string>("");
    const [userRole, setUserRole] = useState<string>("");
    const [generating, setGenerating] = useState(false);
    const [history, setHistory] = useState<ReportHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

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

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

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
                auditType || undefined,
                dateRange || undefined,
                userRole || undefined
            );

            toast({
                title: t('reports_generated_success'),
                description: t('reports_generated_success_desc'),
            });

            // Refresh history
            fetchHistory();

            // Auto-download
            if (response.data) {
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = globalThis.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `report_${Date.now()}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                globalThis.URL.revokeObjectURL(url);
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: t('reports_generation_failed'),
                description: error.response?.data?.detail || t('reports_generation_error'),
            });
        } finally {
            setGenerating(false);
        }
    };

    const handleDownload = async (report: ReportHistoryItem) => {
        if (!report.filename) {
            toast({
                variant: "destructive",
                title: t('common_error'),
                description: t('reports_file_not_found'),
            });
            return;
        }

        setDownloadingId(report.id);
        try {
            const blob = await downloadReport(report.filename);
            const url = globalThis.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', report.filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            globalThis.URL.revokeObjectURL(url);
        } catch (error) {
            toast({
                variant: "destructive",
                title: t('download_failed'),
                description: t('reports_download_failed'),
            });
        } finally {
            setDownloadingId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ready':
                return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className={`w-3 h-3 ${isRtl ? 'ml-1' : 'mr-1'}`} />{t('status_ready')}</Badge>;
            case 'processing':
                return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Loader2 className={`w-3 h-3 ${isRtl ? 'ml-1' : 'mr-1'} animate-spin`} />{t('status_processing')}</Badge>;
            case 'expired':
                return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20"><XCircle className={`w-3 h-3 ${isRtl ? 'ml-1' : 'mr-1'}`} />{t('status_expired')}</Badge>;
            default:
                return <Badge variant="outline"><Clock className={`w-3 h-3 ${isRtl ? 'ml-1' : 'mr-1'}`} />{t('status_unknown')}</Badge>;
        }
    };

    const filteredHistory = history.filter(r =>
        r.report_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.created_by?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.timestamp?.includes(searchQuery)
    );

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar />

            <main className={`${isRtl ? 'pr-[80px]' : 'pl-[80px]'} p-6 overflow-auto transition-all duration-300`}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="text-start">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent italic">
                            {t('reports_command_center')}
                        </h1>
                        <p className="text-muted-foreground">{t('reports_command_center_desc')}</p>
                    </div>

                    <div className="grid lg:grid-cols-[25%_75%] gap-6">
                        {/* Configuration Sidebar - 25% */}
                        <Card className="bg-slate-900/50 border-slate-700">
                            <CardHeader className="text-start">
                                <CardTitle className="flex items-center gap-2 text-slate-100">
                                    <Settings className="w-5 h-5 text-slate-400" />
                                    {t('reports_configuration')}
                                </CardTitle>
                                <CardDescription className="text-slate-400">{t('reports_configuration_desc')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-start">
                                <div className="space-y-2">
                                    <Label htmlFor="report-type">{t('reports_type_label')}</Label>
                                    <Select value={reportType} onValueChange={setReportType}>
                                        <SelectTrigger id="report-type">
                                            <SelectValue placeholder={t('reports_select_type_placeholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="User Activity Audit">{t('reports_type_user_activity')}</SelectItem>
                                            <SelectItem value="Data Export Log">{t('reports_type_data_export')}</SelectItem>
                                            <SelectItem value="System Health">{t('reports_type_system_health')}</SelectItem>
                                            <SelectItem value="Database Changes">{t('reports_type_database_changes')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="audit-type">{t('reports_audit_type_label')}</Label>
                                    <Select value={auditType} onValueChange={setAuditType}>
                                        <SelectTrigger id="audit-type">
                                            <SelectValue placeholder={t('reports_all_types')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">{t('reports_all_types')}</SelectItem>
                                            <SelectItem value="user_actions">{t('reports_audit_user_actions')}</SelectItem>
                                            <SelectItem value="export_history">{t('reports_audit_export_history')}</SelectItem>
                                            <SelectItem value="database_changes">{t('reports_audit_database_changes')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="date-range">{t('reports_date_range_label')}</Label>
                                    <Select value={dateRange} onValueChange={setDateRange}>
                                        <SelectTrigger id="date-range">
                                            <SelectValue placeholder={t('reports_select_range_placeholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">{t('reports_range_all_time')}</SelectItem>
                                            <SelectItem value="today">{t('reports_range_today')}</SelectItem>
                                            <SelectItem value="week">{t('reports_range_week')}</SelectItem>
                                            <SelectItem value="month">{t('reports_range_month')}</SelectItem>
                                            <SelectItem value="quarter">{t('reports_range_quarter')}</SelectItem>
                                            <SelectItem value="year">{t('reports_range_year')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="user-role">{t('reports_user_role_label')}</Label>
                                    <Select value={userRole} onValueChange={setUserRole}>
                                        <SelectTrigger id="user-role">
                                            <SelectValue placeholder={t('reports_all_roles')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">{t('reports_all_roles')}</SelectItem>
                                            <SelectItem value="admin">{t('role_admin')}</SelectItem>
                                            <SelectItem value="analyst">{t('role_analyst')}</SelectItem>
                                            <SelectItem value="researcher">{t('role_researcher')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    className="w-full"
                                    onClick={handleGenerate}
                                    disabled={generating || !reportType}
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} />
                                            {t('reports_generating_btn')}
                                        </>
                                    ) : (
                                        <>
                                            <FileText className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                                            {t('reports_generate_btn')}
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>

                        {/* History Table - 75% */}
                        <Card className="bg-slate-900/50 border-slate-700">
                            <CardHeader className="text-start">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-slate-100">{t('reports_history_title')}</CardTitle>
                                        <CardDescription className="text-slate-400">{t('reports_history_desc')}</CardDescription>
                                    </div>
                                    <div className="relative w-64">
                                        <Search className={`absolute ${isRtl ? 'right-2' : 'left-2'} top-2.5 h-4 w-4 text-slate-400`} />
                                        <Input
                                            placeholder={t('reports_search_placeholder')}
                                            className={`${isRtl ? 'pr-8' : 'pl-8'}`}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="w-full">
                                    {loading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : filteredHistory.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-slate-700">
                                                    <TableHead className="text-slate-300 text-start">{t('reports_table_date')}</TableHead>
                                                    <TableHead className="text-slate-300 text-start">{t('reports_table_type')}</TableHead>
                                                    <TableHead className="text-slate-300 text-start">{t('reports_table_created_by')}</TableHead>
                                                    <TableHead className="text-slate-300 text-start">{t('reports_table_parameters')}</TableHead>
                                                    <TableHead className="text-slate-300 text-start">{t('reports_table_status')}</TableHead>
                                                    <TableHead className="text-slate-300 text-start">{t('reports_table_download')}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredHistory.map((report) => (
                                                    <TableRow key={report.id} className="border-slate-800 hover:bg-slate-800/50">
                                                        <TableCell className="font-medium text-slate-200 text-start">
                                                            {new Date(report.timestamp).toLocaleDateString()}
                                                        </TableCell>
                                                        <TableCell className="text-slate-300 text-start">
                                                            {report.report_type || 'N/A'}
                                                        </TableCell>
                                                        <TableCell className="text-slate-300 text-start">{report.created_by || 'N/A'}</TableCell>
                                                        <TableCell className="text-slate-300 text-start">
                                                            <div className="max-w-[200px] truncate">
                                                                {typeof report.filters_applied === 'object'
                                                                    ? JSON.stringify(report.filters_applied)
                                                                    : report.filters_applied || 'N/A'
                                                                }
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-start">
                                                            {getStatusBadge(report.status)}
                                                        </TableCell>
                                                        <TableCell className="text-start">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                                                                onClick={() => handleDownload(report)}
                                                                disabled={downloadingId === report.id || report.status !== 'ready'}
                                                            >
                                                                {downloadingId === report.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Download className="w-4 h-4" />
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="text-center py-12 text-slate-400">
                                            <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                            <p>{t('reports_no_history_found')}</p>
                                        </div>
                                    )}
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Reports;
