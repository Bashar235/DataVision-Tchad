import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Database as DatabaseIcon, Download, Search, Loader2, Trash2, HardDrive, Eye, Copy, Check, Info, Clock, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import React, { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAdminTables, performBackup, truncateTable, previewTable, getDictionary, getDatasets, getDatasetPreview } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DataTableCell = ({ value, columnName }: { value: any; columnName: string }) => {
  const [copied, setCopied] = useState(false);
  const { t, isRtl } = useLanguage();
  const isTechnical = ['proj4text', 'srtext', 'indicators_id', 'indicator_code'].includes(columnName.toLowerCase());

  const displayValue = value !== null && value !== undefined ? String(value) : t('common_null');
  const isTruncated = displayValue.length > 50;
  const shortValue = isTruncated ? displayValue.substring(0, 47) + "..." : displayValue;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(displayValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (value === null || value === undefined) {
    return <Badge variant="secondary" className="opacity-50 text-[10px] font-mono">{t('common_null')}</Badge>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`group relative flex items-center gap-2 max-w-[250px] ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className={`
              ${isTechnical ? 'font-mono bg-muted/50 px-1 py-0.5 rounded text-[11px]' : 'text-sm'}
              truncate
            `}>
              {shortValue}
            </span>
            <button
              onClick={handleCopy}
              className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded ${isRtl ? 'mr-auto' : 'ml-auto'} flex-shrink-0`}
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-md break-all">
          <p className="text-xs font-mono">{displayValue}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const Database = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [tables, setTables] = useState<any[]>([]);
  const [truncateDialog, setTruncateDialog] = useState<{ open: boolean; tableName: string | null }>({
    open: false,
    tableName: null,
  });
  const [confirmText, setConfirmText] = useState("");
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; data: any | null }>({
    open: false,
    data: null,
  });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dictionary, setDictionary] = useState<any[]>([]);
  const [activeModalTab, setActiveModalTab] = useState("sample");

  // Get user role from sessionStorage
  const userRole = sessionStorage.getItem('userRole') || 'analyst';

  const fetchTables = useCallback(async () => {
    setLoading(true);
    try {
      const allDatasets = await getDatasets();
      // Filter for CLEANED only as per objective
      const cleaned = allDatasets.filter((d: any) => d.status === "CLEANED");

      const mapped = cleaned.map((d: any) => ({
        id: d.id,
        name: d.name,
        records: d.row_count || 0,
        size: "KB",
        updated: new Date(d.date).toLocaleString(),
        isDataset: true,
        health_score: d.health_score || 0
      }));
      setTables(mapped);
    } catch (error) {
      console.error("Failed to fetch tables", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables, refreshKey]);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const response = await performBackup();
      toast({
        title: t('database_backup_created'),
        description: t('database_backup_saved').replace('{file}', response.file),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('database_backup_failed'),
        description: t('database_backup_error'),
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleTruncateClick = (tableName: string) => {
    setTruncateDialog({ open: true, tableName });
    setConfirmText("");
  };

  const handleTruncateConfirm = async () => {
    if (confirmText !== "DELETE" || !truncateDialog.tableName) {
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('database_confirm_delete_instruction'),
      });
      return;
    }

    try {
      await truncateTable(truncateDialog.tableName);
      toast({
        title: t('common_success'),
        description: t('database_truncate_success_desc'),
      });
      setTruncateDialog({ open: false, tableName: null });
      setConfirmText("");
      fetchTables(); // Refresh
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('database_truncate_error'),
      });
    }
  };

  const handlePreview = async (tableName: string, isDataset?: boolean, datasetId?: number) => {
    // Clear old state before starting new fetch to avoid flickering
    setPreviewDialog({ open: true, data: null });
    setPreviewLoading(true);
    setActiveModalTab("sample");
    setDictionary([]);
    try {
      let data;
      if (isDataset && datasetId) {
        const preview = await getDatasetPreview(datasetId);
        // Map getDatasetPreview response to Database's expected preview format
        data = {
          table_name: tableName,
          columnNames: preview.headers,
          sample_data: preview.data,
          rowCount: preview.total_rows || preview.data.length,
          completeness: 100 // Default for cleaned datasets
        };
      } else {
        const [tableData, dict] = await Promise.all([
          previewTable(tableName),
          getDictionary(tableName)
        ]);
        data = tableData;
        setDictionary(dict);
      }

      setPreviewDialog({ open: true, data });
      setRefreshedAt(new Date().toLocaleTimeString());
    } catch (error: any) {
      setPreviewDialog({ open: true, data: null }); // Keep dialog open but show error if needed
      toast({
        variant: "destructive",
        title: t('preview_failed_title'),
        description: error.response?.data?.detail || t('preview_failed_desc'),
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mainPadding = isRtl ? 'pr-[80px]' : 'pl-[80px]';

  return (
    <div className="min-h-screen bg-background">
      <AnalystSidebar />

      <main className={`${mainPadding} p-6 overflow-auto transition-all duration-300`}>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-start">
            <h1 className="text-3xl font-bold text-foreground">
              {userRole === 'analyst' ? t('side_nav_database') : t('database_title')}
            </h1>
            <p className="text-muted-foreground">{t('database_subtitle')}</p>
          </div>

          <Card>
            <CardHeader className="text-start">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  {t('database_datasets_table')}
                  {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
                    <Input
                      placeholder={t('database_search_tables')}
                      className={`${isRtl ? 'pr-10' : 'pl-10'} w-64`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" onClick={handleBackup} disabled={backupLoading}>
                    {backupLoading ? (
                      <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} />
                    ) : (
                      <HardDrive className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                    )}
                    {t('database_backup_now')}
                  </Button>
                  <Button variant="outline">
                    <Download className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                    {t('database_export_data')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{t('data_table')}</TableHead>
                      <TableHead className="text-start">{t('database_total_records')}</TableHead>
                      <TableHead className="text-start">{t('database_size')}</TableHead>
                      <TableHead className="text-start">{t('database_recent_activity')}</TableHead>
                      <TableHead className="text-end">{t('database_actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTables.map((table) => (
                      <TableRow key={table.name}>
                        <TableCell className="font-medium text-start">
                          <div className="flex items-center gap-2">
                            <DatabaseIcon className="w-4 h-4 text-primary" />
                            {table.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-start">{table.records.toLocaleString()}</TableCell>
                        <TableCell className="text-start">{table.size}</TableCell>
                        <TableCell className="text-start">{table.updated}</TableCell>
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(table.name, table.isDataset, table.id)}
                              disabled={previewLoading}
                            >
                              <Eye className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                              {t('database_inspect')}
                            </Button>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span> {/* Wrapper for disabled button tooltip */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        // Trigger export
                                        toast({ title: t('common_export'), description: "Opening export module..." });
                                      }}
                                      disabled={table.health_score < 95}
                                      className={table.health_score < 95 ? "opacity-50 cursor-not-allowed" : "text-emerald-600 hover:text-emerald-700"}
                                    >
                                      <Download className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                                      {t('common_export')}
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {table.health_score < 95 && (
                                  <TooltipContent>
                                    <p className="flex items-center gap-1 text-xs">
                                      <AlertCircle className="w-3 h-3 text-amber-500" />
                                      {t('quality_gate_locked')}
                                    </p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>

                            {(userRole === 'admin' || userRole === 'administrator') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleTruncateClick(table.name)}
                              >
                                <Trash2 className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                                {t('database_truncate')}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTables.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {t('no_anomalies')}
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

      <AlertDialog open={truncateDialog.open} onOpenChange={(open) => {
        if (!open) {
          setTruncateDialog({ open: false, tableName: null });
          setConfirmText("");
        }
      }}>
        <AlertDialogContent className="text-start">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ {t('common_warning')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t('database_truncate_warning')}:{" "}
                <code className="bg-muted px-2 py-1 rounded">{truncateDialog.tableName}</code>
              </p>
              <p className="text-destructive font-semibold">
                {t('database_truncate_cannot_undo')}
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('database_confirm_delete_instruction')}
                </label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRtl ? 'flex-row-reverse gap-2' : ''}>
            <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTruncateConfirm}
              className="bg-destructive hover:bg-destructive/90"
              disabled={confirmText !== "DELETE"}
            >
              {t('database_confirm_truncate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewDialog.open} onOpenChange={(open) => {
        if (!open) setPreviewDialog({ open: false, data: null });
      }}>
        <DialogContent className="sm:max-w-[95vw] max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden text-start">
          <div className="p-6 pb-2">
            <DialogHeader className="text-start">
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <DatabaseIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground block">{t('database_data_preview')}</span>
                    <span className="text-xl font-bold">{previewDialog.data?.table_name}</span>
                  </div>
                </div>
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t('database_lock_desc')}
              </DialogDescription>
            </DialogHeader>

            <Tabs value={activeModalTab} onValueChange={setActiveModalTab} className="mt-4">
              <TabsList className={`grid w-[400px] grid-cols-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <TabsTrigger value="sample">{t('database_sample_data')}</TabsTrigger>
                <TabsTrigger value="dictionary">{t('database_dictionary')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1 px-6">
            {previewLoading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary/40" />
                <div className="space-y-1 text-center">
                  <p className="text-sm font-bold tracking-tight">{t('common_loading')}</p>
                </div>
              </div>
            ) : activeModalTab === "dictionary" ? (
              <div className="space-y-4 pb-8">
                <div className="grid gap-4 pt-4">
                  {dictionary.length > 0 ? dictionary.map((item, idx) => (
                    <Card key={idx} className="border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
                      <CardContent className="p-4 flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary">{item.display_name}</span>
                            <Badge variant="outline" className="text-[10px] font-mono">{item.column_name}</Badge>
                            <Badge variant="secondary" className="text-[10px] uppercase">{item.data_type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )) : (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                      {t('database_no_dictionary')}
                    </div>
                  )}
                </div>
              </div>
            ) : previewDialog.data && (
              <div className="space-y-8 pb-8">
                {/* Header Snapshot: Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10 shadow-none relative overflow-hidden group">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-1.5 bg-background rounded-md shadow-sm">
                          <HardDrive className="w-4 h-4 text-primary" />
                        </div>
                        <Info className="w-3.5 h-3.5 text-muted-foreground/40" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('database_rows')}</span>
                      <p className="text-3xl font-black tracking-tighter mt-1">{(previewDialog.data.rowCount || 0).toLocaleString()}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10 shadow-none relative overflow-hidden group">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-1.5 bg-background rounded-md shadow-sm">
                          <Check className="w-4 h-4 text-primary" />
                        </div>
                        <div className={`w-2 h-2 rounded-full ${previewDialog.data.completeness > 90 ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('database_completeness')}</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <p className="text-3xl font-black tracking-tighter">{previewDialog.data.completeness}%</p>
                        <Badge variant="outline" className={`
                          ${previewDialog.data.completeness > 90 ? 'text-green-600 border-green-200 bg-green-50' : 'text-amber-600 border-amber-200 bg-amber-50'}
                          text-[9px] px-1 py-0
                        `}>
                          {previewDialog.data.completeness > 90 ? t('database_reliable') : t('database_scan_needed')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10 shadow-none relative overflow-hidden group">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-1.5 bg-background rounded-md shadow-sm">
                          <Layers className="w-4 h-4 text-primary" />
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('database_columns')}</span>
                      <p className="text-3xl font-black tracking-tighter mt-1">{previewDialog.data.columnNames?.length || 0}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Data Table Area */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <Info className="w-3 h-3 text-primary" />
                      {t('database_first_five_rows')}
                    </h3>
                  </div>

                  <div className="border rounded-xl bg-muted/30 overflow-hidden w-full">
                    <div className="max-h-[45vh] overflow-y-auto overflow-x-auto w-full">
                      <div className="min-w-full inline-block align-middle">
                        <Table>
                          <TableHeader className="bg-muted/50 border-b sticky top-0 z-10">
                            <TableRow className="hover:bg-transparent">
                              {previewDialog.data.columnNames?.map((col: string) => (
                                <TableHead key={col} className="h-10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground min-w-[180px] text-start bg-background">
                                  {col}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewDialog.data.sample_data?.length > 0 ? (
                              previewDialog.data.sample_data.map((row: any, idx: number) => (
                                <TableRow key={idx} className="hover:bg-background/50 transition-colors border-b last:border-0 border-muted/50">
                                  {previewDialog.data.columnNames?.map((col: string) => (
                                    <TableCell key={col} className="py-2.5 px-4 h-12 text-start">
                                      <DataTableCell value={row[col]} columnName={col} />
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={previewDialog.data.columnNames?.length || 1} className="h-48 text-center bg-background">
                                  <div className="flex flex-col items-center justify-center gap-4 py-8">
                                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                                      <Search className="w-8 h-8 text-muted-foreground/20" />
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm font-bold">{t('database_no_recent_uploads')}</p>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer / Metadata */}
                <div className="border-t pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{t('database_recent_activity')}: <span className="text-foreground">{refreshedAt}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default Database;
