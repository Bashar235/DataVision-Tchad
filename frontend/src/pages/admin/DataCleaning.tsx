import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    AlertCircle, CheckCircle, XCircle, Loader2, FileDown,
    AlertTriangle, Zap, Database, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAdminIssues, downloadCleaningReport } from "@/services/api";
import { useEffect, useState, useCallback } from "react";
import { Progress } from "@/components/ui/progress";

/**
 * AdminDataCleaning — Issues Found Panel
 *
 * Design spec:
 * - READ-ONLY live feed: shows Suspicious Values, Extreme Outliers, Duplicates
 * - NO "Correct" button — corrections are managed via the AI Deep Scan modal
 * - Download report downloads the cleaning audit log as CSV
 */
const AdminDataCleaning = () => {
    const { toast } = useToast();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [issues, setIssues] = useState<any[]>([]);
    const [progress, setProgress] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);

    const fetchIssues = useCallback(async () => {
        setLoading(true);
        setProgress(10);

        const interval = setInterval(() => {
            setProgress(old => {
                if (old >= 90) return old;
                return old + 10;
            });
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

    useEffect(() => {
        fetchIssues();
    }, [fetchIssues, refreshKey]);


    // Map issue type to a readable category
    const getIssueCategory = (type: string): 'suspicious' | 'outlier' | 'duplicate' => {
        const lower = type.toLowerCase();
        if (lower.includes('duplicate') || lower.includes('duplic')) return 'duplicate';
        if (lower.includes('outlier') || lower.includes('extreme')) return 'outlier';
        return 'suspicious';
    };

    const categoryMeta = {
        suspicious: { label: 'Suspicious Value', Icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
        outlier: { label: 'Extreme Outlier', Icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
        duplicate: { label: 'Duplicate', Icon: Database, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    };

    return (
        <div className="w-full space-y-6">

            {loading && (
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground flex items-center gap-2 text-start">
                        <Loader2 className="h-4 w-4 animate-spin" /> {t('data_cleaning_scanning')}
                    </p>
                    <Progress value={progress} className="h-2" />
                </div>
            )}

            {/* Summary cards */}
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

            {/* Issues Found — READ-ONLY panel */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between text-start">
                    <div>
                        <CardTitle>{t('issues_found')}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                            Live feed · Use <strong>AI Deep Scan</strong> above to correct issues
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRefreshKey(k => k + 1)}
                        disabled={loading}
                        className="gap-1 text-muted-foreground"
                    >
                        <Loader2 className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {issues.length > 0 ? issues.map((issue) => {
                            const cat = getIssueCategory(issue.type);
                            const meta = categoryMeta[cat];
                            return (
                                <div
                                    key={issue.id}
                                    className={`flex items-center justify-between p-4 border rounded-xl ${meta.bg} transition-colors`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg bg-white/60 ${meta.color}`}>
                                            <meta.Icon className="w-4 h-4" />
                                        </div>
                                        <div className="text-start">
                                            <p className="font-semibold text-sm text-slate-900">{meta.label}</p>
                                            <p className="text-xs text-slate-600 mt-0.5">
                                                <span className="font-mono font-medium">{issue.count}</span> occurrence{issue.count !== 1 ? 's' : ''} in{' '}
                                                <code className="bg-white/70 px-1 rounded border border-current/20 text-[11px]">
                                                    {issue.dataset || 'database'}
                                                </code>
                                            </p>
                                            {issue.suggested_fix && (
                                                <p className="text-xs text-primary mt-1 italic">💡 {issue.suggested_fix}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <Badge
                                            variant={
                                                issue.severity === "high" ? "destructive" :
                                                    issue.severity === "medium" ? "default" : "secondary"
                                            }
                                        >
                                            {t(`severity_${issue.severity}`)}
                                        </Badge>
                                        {/* READ-ONLY: no Correct button */}
                                    </div>
                                </div>
                            );
                        }) : (
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
