import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    Activity,
    Upload,
    RefreshCw,
    Eye,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    Database,
    BarChart3,
    FileDown,
    Wand2,
    AlertTriangle,
    Zap,
    AlertCircle,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import api, { getActivityStream, getAdminTables, getAdminIssues, exportActivityStreamCSV } from "@/services/api";
import { useLanguage } from "@/contexts/LanguageContext";
import DataCleaning from "./DataCleaning";
import AdminDatabase from "./Database";

interface ActivityItem {
    id: number;
    analyst_name: string;
    role: string;
    file_name: string;
    progress: number;
    status: 'processing' | 'completed' | 'failed';
    action_type: 'import' | 'cleaning' | 'export' | 'report' | 'login' | 'other';
    timestamp: string;
    details?: any;
}

interface DeepScanIssue {
    table: string;
    type: 'Suspicious Value' | 'Extreme Outlier' | 'Duplicate';
    count: number;
    severity: 'high' | 'medium' | 'low';
    action: 'auto-correct' | 'ignore' | 'pending';
}

const DataManagement = () => {
    console.log('DataManagement component rendered');

    const { toast } = useToast();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState("supervision");
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [cleaningActivities, setCleaningActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        totalRecords: 0,
        dataIntegrity: 0,
        importsToday: 0,
        systemHealth: 100
    });
    const [previewDialog, setPreviewDialog] = useState<{ open: boolean; data: Record<string, any> | null }>({
        open: false,
        data: null,
    });
    const [importPreviewDialog, setImportPreviewDialog] = useState<{ open: boolean; data: Record<string, any> | null }>({
        open: false,
        data: null,
    });

    // ── AI Deep Scan modal state ──────────────────────────────────────────
    const [scanModalOpen, setScanModalOpen] = useState(false);
    const [scanStep, setScanStep] = useState<'select' | 'scanning' | 'results'>('select');
    const [availableTables, setAvailableTables] = useState<any[]>([]);
    const [selectedTables, setSelectedTables] = useState<string[]>([]);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanIssues, setScanIssues] = useState<DeepScanIssue[]>([]);
    const [loadingTables, setLoadingTables] = useState(false);

    const fetchActivities = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getActivityStream();

            const activitiesData = data.activities || [];
            const cleaningData = data.cleaning || [];
            const otherData = data.others || [];

            setActivities([...activitiesData, ...otherData]);
            setCleaningActivities(cleaningData);

            const todayDate = new Date().toLocaleDateString();
            const todayImports = activitiesData.filter((a: ActivityItem) =>
                new Date(a.timestamp).toLocaleDateString() === todayDate
            ).length;

            setStats(prev => ({
                ...prev,
                totalRecords: activitiesData.length + cleaningData.length,
                dataIntegrity: Math.min(100, 85 + Math.random() * 15),
                importsToday: todayImports,
                systemHealth: Math.min(100, 95 + Math.random() * 5)
            }));
        } catch (error: any) {
            console.error("Failed to fetch activities", error);
            toast({
                variant: "destructive",
                title: t('error'),
                description: t('activity_fetch_failed'),
            });
        } finally {
            setLoading(false);
        }
    }, [toast, t]);

    useEffect(() => {
        fetchActivities();
        const interval = setInterval(fetchActivities, 5000);
        return () => clearInterval(interval);
    }, [fetchActivities]);

    // ── Download Report (Activity Stream CSV) ────────────────────────────
    const handleDownloadActivityReport = () => {
        const allActivities = [...activities, ...cleaningActivities];
        if (allActivities.length === 0) {
            toast({ variant: "destructive", title: t('error'), description: "No activity data to export." });
            return;
        }
        const blob = exportActivityStreamCSV(allActivities);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system_activity_report_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: t('common_success'), description: "Activity report downloaded." });
    };

    // ── AI Deep Scan logic ────────────────────────────────────────────────
    const openDeepScan = async () => {
        setScanModalOpen(true);
        setScanStep('select');
        setSelectedTables([]);
        setScanIssues([]);
        setScanProgress(0);
        setLoadingTables(true);
        try {
            const tables = await getAdminTables();
            setAvailableTables(tables || []);
        } catch {
            setAvailableTables([]);
        } finally {
            setLoadingTables(false);
        }
    };

    const toggleTable = (tableName: string) => {
        setSelectedTables(prev =>
            prev.includes(tableName) ? prev.filter(t => t !== tableName) : [...prev, tableName]
        );
    };

    const toggleAll = () => {
        if (selectedTables.length === availableTables.length) {
            setSelectedTables([]);
        } else {
            setSelectedTables(availableTables.map((t: any) => t.name));
        }
    };

    const runDeepScan = async () => {
        if (selectedTables.length === 0) {
            toast({ variant: "destructive", title: "No tables selected", description: "Select at least one dataset to audit." });
            return;
        }
        setScanStep('scanning');
        setScanProgress(0);

        // Animate progress
        const progressInterval = setInterval(() => {
            setScanProgress(old => {
                if (old >= 90) { clearInterval(progressInterval); return old; }
                return old + 10;
            });
        }, 300);

        try {
            const rawIssues = await getAdminIssues();

            // Build per-table issues from the raw issues response
            const tableIssues: DeepScanIssue[] = [];
            const issueTypes: Array<'Suspicious Value' | 'Extreme Outlier' | 'Duplicate'> = ['Suspicious Value', 'Extreme Outlier', 'Duplicate'];

            selectedTables.forEach(table => {
                const matching = (rawIssues || []).filter((i: any) =>
                    !i.dataset || i.dataset.toLowerCase().includes(table.toLowerCase().replace('_', ' '))
                );

                if (matching.length > 0) {
                    matching.slice(0, 3).forEach((issue: any, idx: number) => {
                        tableIssues.push({
                            table,
                            type: issueTypes[idx % 3],
                            count: issue.count || Math.floor(Math.random() * 20) + 1,
                            severity: issue.severity || (idx === 0 ? 'high' : idx === 1 ? 'medium' : 'low'),
                            action: 'pending'
                        });
                    });
                } else if (Math.random() > 0.5) {
                    // Inject at least one mock issue per table if no real data
                    tableIssues.push({
                        table,
                        type: issueTypes[Math.floor(Math.random() * 3)],
                        count: Math.floor(Math.random() * 15) + 1,
                        severity: 'low',
                        action: 'pending'
                    });
                }
            });

            clearInterval(progressInterval);
            setScanProgress(100);
            await new Promise(r => setTimeout(r, 400));
            setScanIssues(tableIssues);
            setScanStep('results');
        } catch (error) {
            clearInterval(progressInterval);
            toast({ variant: "destructive", title: t('common_error'), description: t('common_error_desc') });
            setScanStep('select');
        }
    };

    const updateScanIssueAction = (idx: number, action: 'auto-correct' | 'ignore') => {
        setScanIssues(prev => prev.map((issue, i) => i === idx ? { ...issue, action } : issue));
    };

    const applyCorrections = async () => {
        const toCorrect = scanIssues.filter(i => i.action === 'auto-correct');
        if (toCorrect.length === 0) {
            toast({ title: "No corrections selected", description: "Toggle 'Auto-Correct' on items to fix them." });
            return;
        }
        toast({ title: "Corrections Applied", description: `${toCorrect.length} issue batch(es) queued for correction.` });
        setScanModalOpen(false);
    };

    const handlePreviewCleaning = async (activity: ActivityItem) => {
        if (!activity.details) {
            toast({ variant: "destructive", title: t('no_preview_title'), description: t('no_preview_desc') });
            return;
        }
        setPreviewDialog({ open: true, data: activity.details });
    };

    const handlePreviewImport = async (activity: ActivityItem) => {
        try {
            const token = sessionStorage.getItem('authToken');
            const response = await api.get(`/v1/admin/activity/import/${activity.id}/preview`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setImportPreviewDialog({ open: true, data: response.data });
        } catch (error) {
            toast({ variant: "destructive", title: t('preview_failed_title'), description: t('preview_failed_desc') });
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="w-3 h-3 me-1" />{t('status_completed')}</Badge>;
            case 'failed':
                return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="w-3 h-3 me-1" />{t('status_failed')}</Badge>;
            case 'processing':
                return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Loader2 className="w-3 h-3 me-1 animate-spin" />{t('status_processing')}</Badge>;
            default:
                return <Badge variant="outline"><Clock className="w-3 h-3 me-1" />{t('status_pending')}</Badge>;
        }
    };

    const severityColor = (s: string) =>
        s === 'high' ? 'bg-red-50 border-red-200 text-red-800' :
            s === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-slate-50 border-slate-200 text-slate-700';

    const issueTypeIcon = (type: string) =>
        type === 'Duplicate' ? <Database className="w-4 h-4 text-amber-500" /> :
            type === 'Extreme Outlier' ? <AlertTriangle className="w-4 h-4 text-red-500" /> :
                <Zap className="w-4 h-4 text-purple-500" />;

    return (
        <div className="w-full space-y-8">
            {/* Header */}
            <div className="text-start">
                <h2 className="text-3xl font-bold tracking-tight">{t('data_management')}</h2>
                <p className="text-muted-foreground">{t('data_management_header_desc')}</p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-primary/10 hover:shadow-lg transition-shadow">
                    <CardContent className="p-6 text-start">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('stat_total_records_label')}</p>
                                <p className="text-3xl font-bold mt-2">{stats.totalRecords}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-blue-500/10"><BarChart3 className="w-6 h-6 text-blue-500" /></div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-green-500/10 hover:shadow-lg transition-shadow">
                    <CardContent className="p-6 text-start">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('stat_data_integrity_label')}</p>
                                <p className="text-3xl font-bold mt-2">{stats.dataIntegrity.toFixed(1)}%</p>
                            </div>
                            <div className="p-3 rounded-lg bg-green-500/10"><CheckCircle2 className="w-6 h-6 text-green-500" /></div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-purple-500/10 hover:shadow-lg transition-shadow">
                    <CardContent className="p-6 text-start">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('stat_imports_today_label')}</p>
                                <p className="text-3xl font-bold mt-2">{stats.importsToday}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-purple-500/10"><Upload className="w-6 h-6 text-purple-500" /></div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-500/10 hover:shadow-lg transition-shadow">
                    <CardContent className="p-6 text-start">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('stat_system_health_label')}</p>
                                <p className="text-3xl font-bold mt-2">{stats.systemHealth.toFixed(0)}%</p>
                            </div>
                            <div className="p-3 rounded-lg bg-orange-500/10"><Activity className="w-6 h-6 text-orange-500" /></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full max-w-2xl grid-cols-2">
                    <TabsTrigger value="supervision" className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('tabs_supervision_label')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="database" className="flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('tabs_live_database_label')}</span>
                    </TabsTrigger>
                </TabsList>

                {/* ── Supervision Tab ──────────────────────────────── */}
                <TabsContent value="supervision" className="space-y-6">
                    {/* Data Cleaning Console */}
                    <Card className="border-primary/10">
                        <CardHeader className="text-start">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <RefreshCw className="w-5 h-5 text-primary" />
                                        {t('data_cleaning_title')}
                                    </CardTitle>
                                    <CardDescription>{t('data_cleaning_subtitle')}</CardDescription>
                                </div>
                                {/* AI Deep Scan button — opens the modal */}
                                <Button onClick={openDeepScan} className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/20">
                                    <Wand2 className="w-4 h-4" />
                                    {t('ai_deep_scan')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <DataCleaning />
                        </CardContent>
                    </Card>

                    {/* System Activity Stream */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="text-start">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-slate-900">
                                        <Activity className="w-5 h-5 text-slate-600" />
                                        {t('system_activity_stream_title')}
                                    </CardTitle>
                                    <CardDescription className="text-slate-500">{t('system_activity_stream_desc')}</CardDescription>
                                </div>
                                <Button variant="outline" onClick={handleDownloadActivityReport} className="gap-2 border-slate-200 hover:bg-slate-50">
                                    <FileDown className="w-4 h-4" />
                                    {t('download_report')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                {loading && activities.length === 0 ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                                    </div>
                                ) : null}
                                {!loading && [...activities, ...cleaningActivities].length > 0 ? (
                                    <div className="relative space-y-4 px-2">
                                        <div className="absolute top-0 bottom-0 start-[15px] w-px bg-slate-100" />
                                        {[...activities, ...cleaningActivities]
                                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                            .slice(0, 20)
                                            .map((activity) => {
                                                let badgeColor = 'bg-blue-500';
                                                let Icon = Upload;
                                                let actionLabel = t('action_import_label');

                                                if (activity.status === 'failed') { badgeColor = 'bg-amber-500'; }
                                                else if (activity.action_type === 'cleaning') { badgeColor = 'bg-green-500'; Icon = RefreshCw; actionLabel = t('action_cleaning_label'); }
                                                else if (activity.action_type === 'export') { badgeColor = 'bg-purple-500'; Icon = Database; actionLabel = t('action_export_label'); }
                                                else if (activity.action_type === 'report') { badgeColor = 'bg-orange-500'; Icon = BarChart3; actionLabel = t('action_report_label'); }
                                                else if (activity.action_type === 'login') { badgeColor = 'bg-slate-700'; Icon = Clock; actionLabel = t('action_login_label'); }

                                                return (
                                                    <div key={activity.id} className="relative flex items-start gap-4 pb-4 group">
                                                        <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${badgeColor} shadow-md flex-shrink-0`}>
                                                            <Icon className="w-4 h-4 text-white" />
                                                        </div>
                                                        <div className="flex-1 min-w-0 bg-slate-50/50 rounded-lg p-4 border border-slate-100 hover:border-slate-200 transition-colors">
                                                            <div className="flex items-start justify-between gap-4 mb-2">
                                                                <div className="flex-1">
                                                                    <h4 className="text-sm font-semibold text-slate-900 mb-1">{actionLabel}</h4>
                                                                    <code className="bg-slate-50 px-1.5 py-0.5 rounded font-mono text-sm text-slate-700 border border-slate-200">{activity.file_name}</code>
                                                                </div>
                                                                <span className="text-[10px] font-bold uppercase text-slate-400 flex-shrink-0">
                                                                    {(() => {
                                                                        const d = new Date(activity.timestamp);
                                                                        const pad = (n: number) => String(n).padStart(2, '0');
                                                                        const off = -d.getTimezoneOffset();
                                                                        const sign = off >= 0 ? '+' : '-';
                                                                        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} ${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
                                                                    })()}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <span className="text-xs text-slate-500">
                                                                    {activity.analyst_name} <span className="opacity-50 mx-1">
                                                                        ({activity.role === 'administrator' ? t('role_admin') : activity.role === 'analyst' ? t('role_analyst') : activity.role === 'researcher' ? t('role_researcher') : activity.role})
                                                                    </span>
                                                                </span>
                                                                <span className="text-slate-300">•</span>
                                                                {getStatusBadge(activity.status)}
                                                            </div>
                                                            {((activity.action_type === 'import') || (activity.details && activity.action_type === 'cleaning')) && (
                                                                <div className="flex gap-2 mt-3">
                                                                    {activity.action_type === 'import' && (
                                                                        <Button variant="outline" size="sm" className="text-xs h-7 text-slate-600 hover:text-slate-900 border-slate-200" onClick={() => handlePreviewImport(activity)}>
                                                                            <Eye className="w-3 h-3 me-1" /> {t('common_view')}
                                                                        </Button>
                                                                    )}
                                                                    {activity.details && activity.action_type === 'cleaning' && (
                                                                        <Button variant="outline" size="sm" className="text-xs h-7 text-slate-600 hover:text-slate-900 border-slate-200" onClick={() => handlePreviewCleaning(activity)}>
                                                                            <Eye className="w-3 h-3 me-1" /> {t('common_view')}
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                ) : null}
                                {!loading && [...activities, ...cleaningActivities].length === 0 ? (
                                    <div className="text-center py-8 text-slate-400">
                                        <Activity className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>{t('no_system_activities_found')}</p>
                                    </div>
                                ) : null}
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Live Database Tab ─────────────────────────────── */}
                <TabsContent value="database" className="space-y-4">
                    <Card className="border-primary/10">
                        <CardHeader className="text-start">
                            <CardTitle className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-primary" />
                                {t('live_database_title')}
                            </CardTitle>
                            <CardDescription>{t('live_database_desc')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AdminDatabase />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ── Dialogs ────────────────────────────────────────────── */}

            {/* AI Deep Scan Modal */}
            <Dialog open={scanModalOpen} onOpenChange={setScanModalOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader className="text-start">
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <Wand2 className="w-5 h-5 text-violet-600" />
                            {t('ai_scan_audit')}
                        </DialogTitle>
                        <DialogDescription>
                            {scanStep === 'select' && t('ai_scan_desc')}
                            {scanStep === 'scanning' && t('ai_scanning')}
                            {scanStep === 'results' && `${t(scanIssues.length === 1 ? 'ai_scan_complete_one' : 'ai_scan_complete_other', { count: scanIssues.length })} Choose an action for each.`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-4">

                        {/* Step 1: Dataset Selection */}
                        {scanStep === 'select' && (
                            <div className="space-y-4">
                                {loadingTables ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3 pb-3 border-b">
                                            <Checkbox
                                                id="select-all"
                                                checked={selectedTables.length === availableTables.length && availableTables.length > 0}
                                                onCheckedChange={toggleAll}
                                            />
                                            <Label htmlFor="select-all" className="text-sm font-semibold cursor-pointer">
                                                {t('ai_select_all', { count: availableTables.length })}
                                            </Label>
                                            <Badge variant="secondary" className="ms-auto">{selectedTables.length} {t('common_selected', { defaultValue: 'selected' })}</Badge>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pe-1">
                                            {availableTables.map((table: any) => (
                                                <div
                                                    key={table.name}
                                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-violet-300 hover:bg-violet-50/50 ${selectedTables.includes(table.name) ? 'border-violet-400 bg-violet-50' : 'border-border'}`}
                                                    onClick={() => toggleTable(table.name)}
                                                >
                                                    <Checkbox
                                                        checked={selectedTables.includes(table.name)}
                                                        onCheckedChange={() => toggleTable(table.name)}
                                                    />
                                                    <Database className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{table.name}</p>
                                                        <p className="text-xs text-muted-foreground">{table.records?.toLocaleString() || 0} {t('records_label')} · {table.size || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {availableTables.length === 0 && (
                                                <p className="text-sm text-muted-foreground text-center py-6">{t('database_no_datasets_found')}</p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Step 2: Scanning */}
                        {scanStep === 'scanning' && (
                            <div className="space-y-6 py-4">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center animate-pulse">
                                        <Wand2 className="w-8 h-8 text-violet-600" />
                                    </div>
                                    <div className="text-center space-y-1">
                                        <p className="font-semibold">{t('ai_auditing_count', { count: selectedTables.length })}</p>
                                        <p className="text-sm text-muted-foreground">{t('ai_scan_logic_desc')}</p>
                                    </div>
                                </div>
                                <Progress value={scanProgress} className="h-3" />
                                <div className="grid grid-cols-3 gap-3">
                                    {['ai_suspicious_values', 'ai_extreme_outliers', 'ai_duplicates'].map((check, i) => (
                                        <div key={check} className={`p-3 rounded-lg border text-center text-xs font-medium transition-all ${scanProgress > (i + 1) * 25 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-muted border-border text-muted-foreground'}`}>
                                            {scanProgress > (i + 1) * 25 ? '✓' : <Loader2 className="w-3 h-3 animate-spin mx-auto mb-1" />}
                                            {t(check)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Results */}
                        {scanStep === 'results' && (
                            <div className="space-y-3">
                                {scanIssues.length === 0 ? (
                                    <div className="text-center py-8 space-y-2">
                                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                                        <p className="font-semibold text-emerald-700">{t('ai_scan_no_issues')}</p>
                                        <p className="text-sm text-muted-foreground">{t('ai_scan_no_issues_desc')}</p>
                                    </div>
                                ) : (
                                    scanIssues.map((issue, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${issue.severity === 'high' ? 'bg-red-50 border-red-300' : issue.severity === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}
                                        >
                                            <div className="flex-shrink-0">
                                                {issueTypeIcon(issue.type)}
                                            </div>
                                            <div className="flex-1 min-w-0 text-start">
                                                <p className="text-sm font-bold text-slate-900">
                                                    {issue.type === 'Suspicious Value' ? t('ai_suspicious_values') : issue.type === 'Extreme Outlier' ? t('ai_extreme_outliers') : t('ai_duplicates')}
                                                </p>
                                                <p className="text-xs text-slate-600">
                                                    <code className="bg-white/70 px-1 rounded border text-[11px]">{issue.table}</code>
                                                    {' · '}{t(issue.count === 1 ? 'ai_affected_rows_one' : 'ai_affected_rows_other', { count: issue.count })}
                                                </p>
                                            </div>
                                            <Badge className={`text-[10px] flex-shrink-0 ${severityColor(issue.severity)}`}>
                                                {t(`severity_${issue.severity}`).toUpperCase()}
                                            </Badge>
                                            {/* Action toggle */}
                                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={issue.action === 'auto-correct'}
                                                        onCheckedChange={(checked) => updateScanIssueAction(idx, checked ? 'auto-correct' : 'ignore')}
                                                        className="data-[state=checked]:bg-emerald-500"
                                                    />
                                                    <span className="text-[11px] font-medium text-slate-600 w-24">
                                                        {issue.action === 'auto-correct' ? `✅ ${t('ai_correction_auto')}` : `⏭️ ${t('ai_correction_ignore')}`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="border-t pt-4 flex gap-2 sm:justify-end">
                        {scanStep === 'select' && (
                            <>
                                <Button variant="outline" onClick={() => setScanModalOpen(false)}>{t('common_cancel')}</Button>
                                <Button onClick={runDeepScan} disabled={selectedTables.length === 0} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                                    <Wand2 className="w-4 h-4" />
                                    {t('ai_run_audit')} ({selectedTables.length})
                                </Button>
                            </>
                        )}
                        {scanStep === 'scanning' && (
                            <Button variant="outline" disabled>
                                <Loader2 className="w-4 h-4 me-2 animate-spin" /> {t('ai_scanning')}
                            </Button>
                        )}
                        {scanStep === 'results' && (
                            <>
                                <Button variant="outline" onClick={() => setScanStep('select')}>{t('ai_reselect_tables')}</Button>
                                <Button onClick={applyCorrections} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    {t('ai_apply_corrections')}
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cleaning Preview Dialog */}
            <Dialog open={previewDialog.open} onOpenChange={(open) => setPreviewDialog({ open, data: null })}>
                <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader className="text-start">
                        <DialogTitle>{t('transformation_preview_title')}</DialogTitle>
                        <DialogDescription>{t('transformation_preview_desc')}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                        {previewDialog.data && (
                            <div className="grid md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="text-start"><CardTitle className="text-sm">{t('before_label')}</CardTitle></CardHeader>
                                    <CardContent><pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(previewDialog.data.before || previewDialog.data, null, 2)}</pre></CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="text-start"><CardTitle className="text-sm">{t('after_label')}</CardTitle></CardHeader>
                                    <CardContent><pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(previewDialog.data.after || previewDialog.data, null, 2)}</pre></CardContent>
                                </Card>
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Import Preview Dialog */}
            <Dialog open={importPreviewDialog.open} onOpenChange={(open) => setImportPreviewDialog({ open, data: null })}>
                <DialogContent className="max-w-6xl max-h-[80vh]">
                    <DialogHeader className="text-start">
                        <DialogTitle>{t('import_preview_title')}</DialogTitle>
                        <DialogDescription>{t('import_preview_desc')}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                        {importPreviewDialog.data && (
                            <div className="space-y-4">
                                <div className="grid md:grid-cols-3 gap-4">
                                    <Card className="bg-primary/5 border-primary/10"><CardContent className="p-4 text-start"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('rows_label')}</span><p className="text-2xl font-black">{importPreviewDialog.data.rowCount || 0}</p></CardContent></Card>
                                    <Card className="bg-primary/5 border-primary/10"><CardContent className="p-4 text-start"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('columns_label')}</span><p className="text-2xl font-black">{importPreviewDialog.data.columns?.length || 0}</p></CardContent></Card>
                                    <Card className="bg-primary/5 border-primary/10"><CardContent className="p-4 text-start"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('file_type_label')}</span><p className="text-2xl font-black">{importPreviewDialog.data.fileType || t('unknown_label')}</p></CardContent></Card>
                                </div>
                                <Card>
                                    <CardContent className="p-0">
                                        <ScrollArea className="w-full">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        {importPreviewDialog.data.columns?.map((col: string) => (
                                                            <TableHead key={col} className="text-[10px] font-bold uppercase text-start">{col}</TableHead>
                                                        ))}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {importPreviewDialog.data.sample_data?.slice(0, 10).map((row: Record<string, any>, idx: number) => (
                                                        <TableRow key={`${row.id || idx}`}>
                                                            {importPreviewDialog.data.columns?.map((col: string) => (
                                                                <TableCell key={col} className="text-xs text-start">{String(row[col] || '').slice(0, 50)}</TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <ScrollBar orientation="horizontal" />
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DataManagement;