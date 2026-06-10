import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Loader2, FileDown, Eye, Database, Search, Clock, CheckCircle2, Play, Download, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import SummaryModal from "@/components/modals/SummaryModal";
import PreviewModal from "@/components/modals/PreviewModal";
import ComparisonModal from "@/components/modals/ComparisonModal";
import { cleanDatasetML, getDatasets, getDatasetPreview, getQualityReport, adminExport, downloadDatasetRaw } from "@/services/api";

const DataCleaning = () => {
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [cleaningId, setCleaningId] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CLEANED'>('ALL');
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  // Modals state
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [cleanSummary, setCleanSummary] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);

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
    window.addEventListener('dataset_cleaned', fetchDatasets);
    return () => window.removeEventListener('dataset_cleaned', fetchDatasets);
  }, [fetchDatasets]);

  const filteredDatasets = useMemo(() => {
    return datasets.filter(ds => {
      const matchesSearch = ds.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || ds.status?.toUpperCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [datasets, searchTerm, statusFilter]);

  const handleClean = (id: string) => {
    navigate(`/analyst/cleaning-console/${id}`);
  };

  const handleInspect = async (id: string) => {
    try {
      const data = await getDatasetPreview(id);
      setPreviewData(data);
      setIsPreviewOpen(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: error.response?.data?.detail || t('error_preview_failed'),
      });
    }
  };

  const handleDownload = async (ds: any) => {
    if (ds.status?.toUpperCase() === "CLEANED") {
        await handleDownloadData(ds.name);
    } else {
        try {
            toast({ title: t('common_download') || 'Téléchargement', description: t('export_started') });
            const blob = await downloadDatasetRaw(ds.id);
            const { downloadFile } = await import("@/utils/fileUtils");
            downloadFile(blob, ds.name);
        } catch (e) {
            toast({ variant: "destructive", title: t('common_error'), description: t('error_download_failed') });
        }
    }
  };

  const handleDownloadQualityReport = async (id: number, filename: string) => {
    try {
      toast({ title: t('quality_audit'), description: t('quality_report_generating') });
      const blob = await getQualityReport(id);
      const downloadName = `Quality_Report_${filename.split('.')[0]}.pdf`;
      const { downloadFile } = await import("@/utils/fileUtils");
      downloadFile(blob, downloadName);
      toast({
        title: t('common_success'),
        description: t('quality_report_success'),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('quality_report_error'),
      });
    }
  };

  const handleDownloadData = async (name: string) => {
    try {
      toast({ title: t('common_export'), description: t('export_started') });
      const blob = await adminExport('excel', name, `${name}_cleaned`);

      // Extension fix: adminExport in backend ensures .xlsx, but frontend download name should match
      const downloadName = `${name}_cleaned.xlsx`;

      const { downloadFile } = await import("@/utils/fileUtils");
      downloadFile(blob, downloadName);

      toast({
        title: t('common_success'),
        description: t('export_traceability'),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('error_download_export'),
      });
    }
  };


  return (
    <div className={`max-w-7xl mx-auto space-y-6 mt-4 pb-12 ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center">
        <div className="text-start">
          <h1 className="text-2xl font-bold text-foreground">{t('cleaning_console')}</h1>
          <p className="text-muted-foreground">{t('data_cleaning_subtitle')}</p>
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${statusFilter === 'ALL' ? 'ring-2 ring-primary bg-primary/5' : ''}`}
          onClick={() => setStatusFilter('ALL')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 text-start">
            <CardTitle className="text-sm font-medium">{t('stat_total_records_label')}</CardTitle>
            <Database className={`w-4 h-4 ${statusFilter === 'ALL' ? 'text-primary' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">{datasets.length}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard_datasets')}</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:ring-2 hover:ring-emerald-500/50 ${statusFilter === 'CLEANED' ? 'ring-2 ring-emerald-500 bg-emerald-50/50' : ''}`}
          onClick={() => setStatusFilter('CLEANED')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 text-start">
            <CardTitle className="text-sm font-medium">{t('status_cleaned')}</CardTitle>
            <CheckCircle className={`w-4 h-4 ${statusFilter === 'CLEANED' ? 'text-emerald-500' : 'text-green-500'}`} />
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">{datasets.filter(d => d.status?.toUpperCase() === "CLEANED").length}</div>
            <p className="text-xs text-muted-foreground">{t('common_success')}</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:ring-2 hover:ring-amber-500/50 ${statusFilter === 'PENDING' ? 'ring-2 ring-amber-500 bg-amber-50/50' : ''}`}
          onClick={() => setStatusFilter('PENDING')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 text-start">
            <CardTitle className="text-sm font-medium">{t('cleaning_pending')}</CardTitle>
            <AlertCircle className={`w-4 h-4 ${statusFilter === 'PENDING' ? 'text-amber-500' : 'text-destructive'}`} />
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">{datasets.filter(d => d.status?.toUpperCase() === "PENDING").length}</div>
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
        <CardHeader className="text-start border-b bg-muted/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              {t('data_import_imported_files')}
              {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('common_search')}
                className="pl-10 w-64 h-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-start pl-6">{t('table_user') /* Filename substitute */}</TableHead>
                  <TableHead className="text-start">{t('table_records') || 'Enregistrements'}</TableHead>
                  <TableHead className="text-center">{t('table_head_status')}</TableHead>
                  <TableHead className="text-start">{t('table_head_time')}</TableHead>
                  <TableHead className="text-end pr-6">{t('table_head_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDatasets.length > 0 ? filteredDatasets.map((ds) => (
                  <TableRow key={ds.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="text-start pl-6 font-semibold">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-primary" />
                        {ds.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-start font-mono text-xs">
                      {ds.records?.toLocaleString() || ds.row_count?.toLocaleString() || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      {ds.status?.toUpperCase() === "CLEANED" ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          {t('status_cleaned').toUpperCase()}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-200 animate-pulse">
                          <Clock className="w-3 h-3" />
                          {t('status_pending').toUpperCase()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-start text-muted-foreground text-xs">
                      {new Date(ds.date).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-end pr-6">
                      <div className="flex justify-end gap-2">
                        <TooltipProvider>
                          <div className="flex gap-2">
                            {ds.status?.toUpperCase() !== "CLEANED" ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="default" 
                                    size="sm" 
                                    className="bg-emerald-600 hover:bg-emerald-700 h-8 text-[10px] font-black min-w-[100px]"
                                      onClick={() => handleClean(ds.id)}
                                      disabled={cleaningId === ds.id}
                                    >
                                      {cleaningId === ds.id ? (
                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      ) : (
                                        <Play className="w-3 h-3 mr-1 fill-current" />
                                      )}
                                      {cleaningId === ds.id ? t('common_loading').toUpperCase() : t('common_clean').toUpperCase()}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('data_cleaning_deep_scan')}</TooltipContent>
                                </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-[10px] font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => {
                                      setSelectedDatasetId(ds.id);
                                      setIsComparisonOpen(true);
                                    }}
                                  >
                                    <Activity className="w-3 h-3 mr-1" /> {t('common_review').toUpperCase()}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('quality_audit')}</TooltipContent>
                              </Tooltip>
                            )}
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleInspect(ds.id)}
                                >
                                  <Eye className="w-4 h-4 text-slate-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('common_preview')}</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                  onClick={() => handleDownload(ds)}
                                >
                                    <Download className="w-4 h-4 text-blue-600" />
                                </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('database_sample_data')}</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                      {t('database_no_recent_uploads')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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

      <ComparisonModal 
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        datasetId={selectedDatasetId}
      />
    </div>
  );
};

export default DataCleaning;
