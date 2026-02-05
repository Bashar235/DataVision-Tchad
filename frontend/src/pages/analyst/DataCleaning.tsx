import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Loader2, FileDown, Eye, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDatasets, cleanDataset, getDatasetPreview, downloadCleaningReport, getQualityReport } from "@/services/api";
import { useEffect, useState, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SummaryModal from "@/components/modals/SummaryModal";
import PreviewModal from "@/components/modals/PreviewModal";

const DataCleaning = () => {
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [cleaningId, setCleaningId] = useState<number | null>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);

  // Modals state
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [cleanSummary, setCleanSummary] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDatasets();
      setDatasets(data);
    } catch (error) {
      console.error("Failed to fetch datasets", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const handleClean = async (id: number) => {
    setCleaningId(id);
    setProgress(20);
    const interval = setInterval(() => setProgress(prev => prev < 90 ? prev + 10 : prev), 300);

    try {
      const result = await cleanDataset(id);
      clearInterval(interval);
      setProgress(100);

      setCleanSummary(result.summary);
      setIsSummaryOpen(true);

      toast({
        title: t('common_success'),
        description: t('status_cleaned'),
      });
      fetchDatasets();
    } catch (error: any) {
      clearInterval(interval);
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: error.response?.data?.detail || "Cleaning failed",
      });
    } finally {
      setCleaningId(null);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handlePreview = async (id: number) => {
    try {
      const data = await getDatasetPreview(id);
      setPreviewData(data);
      setIsPreviewOpen(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: "Failed to load preview",
      });
    }
  };

  const handleDownloadQualityReport = async (id: number, filename: string) => {
    try {
      toast({ title: "Quality Report", description: "Generating diagnostic PDF..." });
      const blob = await getQualityReport(id);
      const downloadName = `Quality_Report_${filename.split('.')[0]}.pdf`;
      const { downloadFile } = await import("@/utils/fileUtils");
      downloadFile(blob, downloadName);
      toast({
        title: t('common_success'),
        description: "Diagnostic report downloaded successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: "Failed to generate quality report.",
      });
    }
  };

  const mainPadding = isRtl ? 'pr-[80px]' : 'pl-[80px]';

  return (
    <div className="min-h-screen bg-background">
      <AnalystSidebar />
      <main className={`${mainPadding} p-6 overflow-auto transition-all duration-300`}>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div className="text-start">
              <h1 className="text-3xl font-bold text-foreground">{t('cleaning_console')}</h1>
              <p className="text-muted-foreground">{t('ai_quality_issues')}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchDatasets} disabled={loading} variant="outline" className="gap-2">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {t('lang_select') /* Refresh substitute */}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 text-start">
                <CardTitle className="text-sm font-medium">{t('stat_total_records_label')}</CardTitle>
                <Database className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">{datasets.length}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard_datasets')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 text-start">
                <CardTitle className="text-sm font-medium">{t('status_cleaned')}</CardTitle>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">{datasets.filter(d => d.status === "CLEANED").length}</div>
                <p className="text-xs text-muted-foreground">{t('common_success')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 text-start">
                <CardTitle className="text-sm font-medium">{t('cleaning_pending')}</CardTitle>
                <AlertCircle className="w-4 h-4 text-destructive" />
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">{datasets.filter(d => d.status === "PENDING").length}</div>
                <p className="text-xs text-muted-foreground">{t('cleaning_action_required')}</p>
              </CardContent>
            </Card>
          </div>

          {progress > 0 && (
            <div className="space-y-2 text-start">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> {t('cleaning_scanning')}
              </p>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Card>
            <CardHeader className="text-start">
              <CardTitle>{t('data_import_imported_files')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{t('table_user') /* Filename substitute */}</TableHead>
                      <TableHead className="text-start">{t('table_head_time')}</TableHead>
                      <TableHead className="text-start">{t('table_head_status')}</TableHead>
                      <TableHead className="text-end">{t('table_head_actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datasets.length > 0 ? datasets.map((ds) => (
                      <TableRow key={ds.id}>
                        <TableCell className="text-start font-medium">
                          <div className="flex items-center gap-2">
                            <FileDown className="w-4 h-4 text-primary" />
                            {ds.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-start text-muted-foreground text-xs">
                          {new Date(ds.date).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-start">
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={ds.status === "CLEANED" ? (ds.health_score >= 95 ? "secondary" : "outline") : ds.status === "PENDING" ? "default" : "destructive"}
                              className="gap-1 justify-center"
                            >
                              {ds.status === "CLEANED" ? (
                                ds.health_score >= 95 ? <CheckCircle className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-amber-500" />
                              ) : ds.status === "PENDING" ? (
                                <AlertCircle className="w-3 h-3 text-yellow-500" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              {ds.status === "CLEANED"
                                ? (ds.health_score >= 95 ? t('verified_clean_badge') : t('cleaning_required_badge'))
                                : t(`status_${ds.status.toLowerCase()}`)
                              }
                            </Badge>
                            {ds.status === "CLEANED" && (
                              <span className={`text-[10px] font-bold text-center ${ds.health_score >= 95 ? 'text-green-600' : 'text-amber-600'}`}>
                                {ds.health_score}% {t('stat_data_integrity_label')}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-end space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(ds.id)} title={t('common_view')}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {ds.status === "CLEANED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadQualityReport(ds.id, ds.name)}
                              className="text-indigo-600 hover:text-indigo-700"
                              title="Download Quality Report"
                            >
                              <FileDown className="w-4 h-4" />
                            </Button>
                          )}
                          {ds.status === "PENDING" && (
                            <Button
                              size="sm"
                              onClick={() => handleClean(ds.id)}
                              disabled={cleaningId === ds.id}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              {cleaningId === ds.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                              {t('cleaning_correct')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                          {t('database_no_recent_uploads')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <SummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        summary={cleanSummary}
      />

      {previewData && (
        <PreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          filename={previewData.filename}
          headers={previewData.headers}
          data={previewData.data}
        />
      )}
    </div>
  );
};

export default DataCleaning;
