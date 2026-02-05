import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Loader2, Wand2, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { adminClean, getAdminIssues, downloadCleaningReport } from "@/services/api";
import { useEffect, useState, useCallback } from "react";

import { Progress } from "@/components/ui/progress";

const AdminDataCleaning = () => {
    const { toast } = useToast();
    const { t, isRtl } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [cleaningId, setCleaningId] = useState<number | null>(null);
    const [issues, setIssues] = useState<any[]>([]);
    const [progress, setProgress] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);

    const fetchIssues = useCallback(async () => {
        setLoading(true);
        setProgress(10);

        // Simulate scan progress
        const interval = setInterval(() => {
            setProgress(old => {
                if (old >= 90) return old;
                return old + 10;
            })
        }, 200);

        try {
            const data = await getAdminIssues();
            setIssues(data);
        } catch (error) {
            console.error("Failed to fetch issues", error);
        } finally {
            clearInterval(interval);
            setProgress(100);
            setTimeout(() => setLoading(false), 500);
        }
    }, []);

    const handleFix = useCallback(async (id: number, type: string) => {
        setCleaningId(id);
        try {
            await adminClean(type);
            toast({
                title: t('issue_resolved'),
                description: t('anomaly_corrected_desc'),
            });
            // Increment refreshKey to force re-render/re-fetch
            setRefreshKey(prev => prev + 1);
        } catch (error) {
            toast({
                variant: "destructive",
                title: t('common_error'),
                description: t('common_error'),
            });
        } finally {
            setCleaningId(null);
        }
    }, [toast, t]);

    useEffect(() => {
        fetchIssues();
    }, [fetchIssues, refreshKey]);

    const handleDownloadReport = async () => {
        setDownloadLoading(true);
        try {
            const blob = await downloadCleaningReport();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cleaning_report_${new Date().getTime()}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast({
                title: t('report_downloaded'),
                description: t('report_download_success'),
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: t('download_failed'),
                description: t('report_download_failed'),
            });
        } finally {
            setDownloadLoading(false);
        }
    };

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <div className="text-start">
                    <h2 className="text-3xl font-bold tracking-tight">
                        {t('data_cleaning_title')} ({t('admin_label')})
                    </h2>
                    <p className="text-muted-foreground">{t('data_cleaning_subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleDownloadReport} disabled={downloadLoading} variant="outline" className="gap-2">
                        {downloadLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <FileDown className="w-4 h-4" />
                        )}
                        {t('data_cleaning_download_report')}
                    </Button>
                    <Button onClick={() => setRefreshKey(k => k + 1)} disabled={loading} className="gap-2">
                        <Wand2 className="w-4 h-4" />
                        {t('data_cleaning_deep_scan')}
                    </Button>
                </div>
            </div>

            {loading && (
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground flex items-center gap-2 text-start">
                        <Loader2 className="h-4 w-4 animate-spin" /> {t('data_cleaning_scanning')}
                    </p>
                    <Progress value={progress} className="h-2" />
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{t('data_cleaning_total_issues')}</CardTitle>
                        <AlertCircle className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent className="text-start">
                        <div className="text-2xl font-bold">{issues.reduce((acc, curr) => acc + curr.count, 0)}</div>
                        <p className="text-xs text-muted-foreground">{t('data_cleaning_across_data')}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{t('data_cleaning_fixed')}</CardTitle>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    </CardHeader>
                    <CardContent className="text-start">
                        <div className="text-2xl font-bold">--</div>
                        <p className="text-xs text-muted-foreground">{t('data_cleaning_check_audit')}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{t('data_cleaning_pending')}</CardTitle>
                        <XCircle className="w-4 h-4 text-destructive" />
                    </CardHeader>
                    <CardContent className="text-start">
                        <div className="text-2xl font-bold">{issues.length} {t('types_label')}</div>
                        <p className="text-xs text-muted-foreground">{t('data_cleaning_action_required')}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-start">{t('issues_found')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {issues.length > 0 ? issues.map((issue) => (
                            <div
                                key={issue.id}
                                className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary/30 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <AlertCircle className="w-5 h-5 text-destructive" />
                                    <div className="text-start">
                                        <div>
                                            <p className="font-medium text-foreground">{t(issue.type.toLowerCase().replace(/ /g, '_')) || issue.type}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {issue.count} {t('issues_found')} {t('in_label')} {issue.dataset}
                                            </p>
                                            {issue.suggested_fix && (
                                                <p className="text-xs text-primary mt-1 italic">
                                                    💡 {issue.suggested_fix}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge
                                        variant={
                                            issue.severity === "high"
                                                ? "destructive"
                                                : issue.severity === "medium"
                                                    ? "default"
                                                    : "secondary"
                                        }
                                    >
                                        {t(`severity_${issue.severity}`)}
                                    </Badge>
                                    <Button
                                        size="sm"
                                        onClick={() => handleFix(issue.id, issue.type)}
                                        disabled={cleaningId === issue.id}
                                        className="bg-primary hover:bg-primary/90"
                                    >
                                        {cleaningId === issue.id ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <RefreshCw className="w-4 h-4 me-2" />}
                                        {t('correct')}
                                    </Button>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-12 text-muted-foreground">
                                {loading ? t('updating_analytics') : t('no_anomalies')}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminDataCleaning;
