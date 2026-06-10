import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Database as DatabaseIcon, Download, Search, Loader2, Trash2, HardDrive, Eye, Copy, Check, Info, Clock, Layers, AlertCircle, AlertTriangle, CheckCircle2, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import React, { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAdminTables, performBackup, truncateTable, previewTable, getDictionary, getDatasets, getDatasetPreview, exportCleanedData, downloadDatasetRaw, deleteDataset, adminExport, bulkDeleteDatasets } from "@/services/api";
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyValidated, setShowOnlyValidated] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [truncateDialog, setTruncateDialog] = useState<{ open: boolean; tableName: string | null }>({
    open: false,
    tableName: null,
  });
  const [confirmText, setConfirmText] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; datasetId: string | null; datasetName: string | null }>({
    open: false,
    datasetId: null,
    datasetName: null,
  });
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; data: any | null }>({
    open: false,
    data: null,
  });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dictionary, setDictionary] = useState<any[]>([]);
  const [activeModalTab, setActiveModalTab] = useState("sample");

  // Bulk-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Get user role from sessionStorage
  const userRole = sessionStorage.getItem('userRole') || 'analyst';

  const fetchTables = useCallback(async () => {
    setLoading(true);
    try {
      const [allDatasets, adminTables] = await Promise.all([
        getDatasets(),
        getAdminTables()
      ]);

      const mappedDatasets = allDatasets.map((d: any) => ({
        id: d.id,
        name: d.name,
        records: d.row_count || 0,
        size: "KB",
        updated: new Date(d.date).toLocaleString(),
        isDataset: true,
        health_score: d.health_score || 0,
        status: d.status === "Uploaded" ? "Unclean" : d.status
      }));

      const mappedAdminTables = adminTables.map((t: any) => ({
        id: t.name,
        name: t.name,
        records: t.records || 0,
        size: t.size || "KB",
        updated: t.updated !== "N/A" ? new Date(t.updated).toLocaleString() : new Date().toLocaleString(),
        isDataset: false,
        health_score: 100, // DB tables are considered clean
        status: "Cleaned"
      }));

      setTables([...mappedDatasets, ...mappedAdminTables]);
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

  const handleDeleteDataset = async () => {
    if (!deleteDialog.datasetId) return;
    
    try {
      setLoading(true);
      await deleteDataset(deleteDialog.datasetId);
      toast({
        title: t('database_delete_success'),
        description: t('database_delete_success_desc', { name: deleteDialog.datasetName }),
      });
      setDeleteDialog({ open: false, datasetId: null, datasetName: null });
      fetchTables();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('database_delete_error_title'),
        description: error.response?.data?.detail || t('database_delete_error_desc'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (tableName: string, isDataset?: boolean, datasetId?: any, totalRows?: number) => {
    // Clear old state before starting new fetch to avoid flickering
    setPreviewDialog({ open: true, data: null });
    setPreviewLoading(true);
    setActiveModalTab("sample");
    setDictionary([]);
    try {
      let data;
      if (isDataset && datasetId) {
        const [preview, dict] = await Promise.all([
          getDatasetPreview(datasetId),
          getDictionary(tableName)
        ]);
        // Map getDatasetPreview response to Database's expected preview format
        data = {
          table_name: tableName,
          columnNames: preview.headers,
          sample_data: preview.data,
          rowCount: totalRows || preview.data.length,
          completeness: 100 // Default for cleaned datasets
        };
        setDictionary(dict);
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

  const filteredTables = tables.filter(table => {
    const matchesSearch = table.name.toLowerCase().includes(searchTerm.toLowerCase());
    const isCleaned = table.status?.toUpperCase() === "CLEANED";
    
    // If showOnlyValidated is true, show only ≥ 95% cleaned
    if (showOnlyValidated) {
      return matchesSearch && isCleaned && (table.health_score || 0) >= 95;
    }
    
    // Default: Show all (Cleaned and Unclean)
    return matchesSearch;
  });

  // ── Bulk-select helpers (depends on filteredTables) ──────────────────────
  const datasetRows = filteredTables.filter((t) => t.isDataset);

  const toggleSelectAll = () => {
    if (selectedIds.length === datasetRows.length && datasetRows.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(datasetRows.map((t) => t.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    setBulkDeleting(true);
    try {
      const result = await bulkDeleteDatasets(selectedIds);
      toast({
        title: t('common_success'),
        description: `${result.deleted_count} dataset(s) deleted successfully.`,
      });
      setSelectedIds([]);
      setBulkDeleteDialog(false);
      fetchTables();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: error.response?.data?.detail || 'Bulk delete failed.',
      });
    } finally {
      setBulkDeleting(false);
    }
  };


  return (
    <div className={`max-w-7xl mx-auto space-y-6 mt-4 ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="text-start">
        <h1 className="text-2xl font-bold text-foreground">
          {userRole === 'analyst' ? t('side_nav_imported_files') || 'Imported Files' : t('database_title')}
        </h1>
        <p className="text-muted-foreground">
          {userRole === 'analyst' ? t('imported_files_desc') || 'Manage and inspect your cleaned datasets ready for analysis.' : t('database_subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader className="text-start">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              {userRole === 'analyst' ? t('side_nav_imported_files') || 'Imported Files' : t('database_datasets_table')}
              {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="validated-mode"
                  checked={showOnlyValidated}
                  onCheckedChange={setShowOnlyValidated}
                />
                <Label htmlFor="validated-mode" className="text-sm cursor-pointer whitespace-nowrap">
                  {t('db_filter_validated_only')}
                </Label>
              </div>
              <div className="relative">
                <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
                <Input
                  placeholder={t('database_search_tables')}
                  className={`${isRtl ? 'pr-10' : 'pl-10'} w-64`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {(userRole === 'admin' || userRole === 'administrator') && (
                <Button variant="outline" onClick={handleBackup} disabled={backupLoading}>
                  {backupLoading ? (
                    <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} />
                  ) : (
                    <HardDrive className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                  )}
                  {t('database_backup_now')}
                </Button>
              )}

              {/* ── Refresh + Bulk-Delete icon group ── */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-muted-foreground hover:text-foreground"
                  onClick={fetchTables}
                  disabled={loading}
                >
                  <Clock className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'} ${loading ? 'animate-spin' : ''}`} />
                  {t('common_refresh') || 'Actualiser'}
                </Button>

                <div className="w-px h-5 bg-border" />

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        id="header-bulk-delete-btn"
                        disabled={selectedIds.length === 0}
                        onClick={() => setBulkDeleteDialog(true)}
                        className={[
                          "h-8 w-8 flex items-center justify-center rounded-md transition-all duration-200",
                          selectedIds.length === 0
                            ? "opacity-35 cursor-not-allowed text-muted-foreground"
                            : "text-red-500 hover:text-red-600 hover:bg-red-500/10 hover:scale-105 cursor-pointer",
                        ].join(" ")}
                        aria-label="Supprimer la sélection"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {selectedIds.length === 0
                        ? "Sélectionnez des enregistrements pour les supprimer"
                        : `Supprimer ${selectedIds.length} sélectionné${selectedIds.length > 1 ? 's' : ''}`}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead className="w-10">
                     <Checkbox
                       id="select-all-datasets"
                       checked={datasetRows.length > 0 && selectedIds.length === datasetRows.length}
                       onCheckedChange={toggleSelectAll}
                       aria-label="Select all datasets"
                     />
                   </TableHead>
                   <TableHead className="text-start">{t('data_table')}</TableHead>
                   <TableHead className="text-start">{t('database_total_records') || 'Enregistrements'}</TableHead>
                   <TableHead className="text-center">{t('common_status') || 'Statut'}</TableHead>
                   <TableHead className="text-start">{t('database_recent_activity')}</TableHead>
                   <TableHead className="text-end">{t('database_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTables.map((table) => (
                  <TableRow
                    key={table.name}
                    data-state={table.isDataset && selectedIds.includes(table.id) ? "selected" : undefined}
                    className={table.isDataset && selectedIds.includes(table.id) ? "bg-primary/5" : ""}
                  >
                    <TableCell className="w-10">
                      {table.isDataset ? (
                        <Checkbox
                          id={`select-${table.id}`}
                          checked={selectedIds.includes(table.id)}
                          onCheckedChange={() => toggleSelectOne(table.id)}
                          aria-label={`Select ${table.name}`}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium text-start">
                      {table.name}
                    </TableCell>
                    <TableCell className="text-start font-mono text-xs">{table.records.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                          {table.status?.toUpperCase() === "CLEANED" ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('status_cleaned') || 'NETTOYÉ'}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-black border border-slate-200">
                              <AlertCircle className="w-3 h-3" />
                              {t('status_uncleaned')}
                            </div>
                          )}
                    </TableCell>
                    <TableCell className="text-start">{table.updated}</TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(table.name, table.isDataset, table.id, table.records)}
                          disabled={previewLoading}
                        >
                          <Eye className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                          {t('database_inspect')}
                        </Button>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    toast({ title: t('common_download') || 'Téléchargement', description: t('export_started') });
                                    let blob;
                                    if (table.isDataset) {
                                      blob = await downloadDatasetRaw(table.id);
                                    } else {
                                      blob = await adminExport("csv", table.name, `${table.name}_export`);
                                    }
                                    const { downloadFile } = await import("@/utils/fileUtils");
                                    downloadFile(blob, table.name);
                                    toast({ title: t('common_success'), description: t('common_download_complete') || 'Fichier récupéré.' });
                                  } catch (error) {
                                    toast({ variant: "destructive", title: t('common_error'), description: t('database_download_failed_desc') });
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Download className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                                {t('common_download') || 'Download'}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">{t('db_download_tooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Clean button removed from this page to maintain strict workflow */}

                        {table.isDataset ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteDialog({ open: true, datasetId: table.id, datasetName: table.name })}
                          >
                            <Trash2 className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                            {t('common_delete') || 'Supprimer'}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleTruncateClick(table.name)}
                          >
                            <Trash2 className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                            {t('common_truncate') || 'Vider'}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTables.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {t('no_anomalies')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => {
        if (!open) setDeleteDialog({ open: false, datasetId: null, datasetName: null });
      }}>
        <AlertDialogContent className={`text-start ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('common_delete')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t('db_confirm_delete_dataset_msg')} <strong>"{deleteDialog.datasetName}"</strong> ?
              </p>
              <p className="text-destructive font-medium bg-red-50 p-2 rounded border border-red-100 text-xs">
                {t('db_delete_irreversible_warning')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRtl ? "gap-2 space-x-reverse" : ""}>
            <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDataset}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t('db_delete_permanent')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewDialog.open} onOpenChange={(open) => {
        if (!open) setPreviewDialog({ open: false, data: null });
      }}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 overflow-hidden text-start">
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

          <div className="flex-1 px-6 overflow-y-auto overflow-x-auto">
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
                  )) : previewDialog.data?.columnNames ? (
                    previewDialog.data.columnNames.map((col: string, idx: number) => (
                      <Card key={idx} className="border-primary/10 bg-gradient-to-br from-muted/5 to-transparent">
                        <CardContent className="p-4 flex justify-between items-start gap-4">
                          <div className="space-y-1 text-start">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-muted-foreground italic">{col}</span>
                              <Badge variant="outline" className="text-[10px] font-mono opacity-50">{col}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground/80 italic">
                              <AlertCircle className={`w-3 h-3 inline ${isRtl ? 'ms-1' : 'me-1'} text-amber-500`} />
                              {t('system_column')} {col}. {t('add_description_strategic')}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                      {t('database_no_dictionary')}
                    </div>
                  )}
                </div>
              </div>
            ) : previewDialog.data && (
              <div className="space-y-6 pb-8">
                {/* Metrics removed for compact look as requested */}

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
                                <TableHead key={col} className="h-10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground min-w-[180px] text-start bg-background whitespace-nowrap">
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
                <div className="border-t pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                      {t('database_recent_activity')}: <span className="text-foreground">{refreshedAt}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Premium Bulk Delete Confirmation Dialog ── */}
      <AlertDialog open={bulkDeleteDialog} onOpenChange={(open) => { if (!open && !bulkDeleting) setBulkDeleteDialog(false); }}>
        <AlertDialogContent
          className="max-w-md text-start"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2.5 text-destructive text-lg">
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100 dark:bg-red-950 flex-shrink-0">
                <Trash2 className="w-4.5 h-4.5 text-red-600" />
              </span>
              Confirmation de suppression groupée
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-1">
                <p className="text-sm text-foreground/80 leading-relaxed">
                  Êtes-vous sûr de vouloir supprimer définitivement ces{" "}
                  <strong className="text-foreground">{selectedIds.length} enregistrement{selectedIds.length > 1 ? 's' : ''}</strong>{" "}
                  ? Cette action est irréversible.
                </p>
                <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                    Toutes les données nettoyées et les indicateurs associés seront également supprimés en cascade.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-2">
            <AlertDialogCancel
              disabled={bulkDeleting}
              className="backdrop-blur-sm"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              id="confirm-bulk-delete-btn"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white min-w-[130px]"
            >
              {bulkDeleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Suppression...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" />Supprimer</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Database;
