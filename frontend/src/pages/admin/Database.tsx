import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Database as DatabaseIcon, Download, Search, Loader2, Trash2, HardDrive, Eye, Copy, Check, Info, Clock, Layers, RefreshCw, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import React, { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAdminTables, performBackup, truncateTable, previewTable, getDictionary } from "@/services/api";
import api from "@/services/api";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const DataTableCell = ({ value, columnName }: { value: any; columnName: string }) => {
    const { t } = useLanguage();
    const [copied, setCopied] = useState(false);
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
                    <div className="group relative flex items-center gap-2 max-w-[250px]">
                        <span className={`
              ${isTechnical ? 'font-mono bg-muted/50 px-1 py-0.5 rounded text-[11px]' : 'text-sm'}
              truncate
            `}>
                            {shortValue}
                        </span>
                        <button
                            onClick={handleCopy}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded ms-auto flex-shrink-0"
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

const AdminDatabase = () => {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [backupLoading, setBackupLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [tables, setTables] = useState<any[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);
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
    const [dictionary, setDictionary] = useState<any[]>([]);
    const [activeModalTab, setActiveModalTab] = useState("sample");
    const [tableLockStatus, setTableLockStatus] = useState<Record<string, boolean>>({});

    const fetchTables = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAdminTables();
            setTables(data);
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
                description: t('database_backup_saved', { file: response.file }),
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
        if (confirmText !== "DELETE" && confirmText !== t('common_delete_uppercase')) {
            toast({
                variant: "destructive",
                title: t('common_error'),
                description: t('database_confirm_delete_instruction'),
            });
            return;
        }

        try {
            await truncateTable(truncateDialog.tableName!);
            toast({
                title: t('database_truncate_success'),
                description: t('database_truncate_success_desc'),
            });
            setTruncateDialog({ open: false, tableName: null });
            setConfirmText("");
            setRefreshKey(prev => prev + 1);
        } catch (error) {
            toast({
                variant: "destructive",
                title: t('database_truncate_failed'),
                description: t('database_truncate_error'),
            });
        }
    };

    const handlePreview = async (tableName: string) => {
        setPreviewDialog({ open: true, data: null });
        setPreviewLoading(true);
        setActiveModalTab("sample");
        setDictionary([]);
        try {
            const [data, dict] = await Promise.all([
                previewTable(tableName),
                getDictionary(tableName)
            ]);
            setPreviewDialog({ open: true, data });
            setDictionary(dict);
            setRefreshedAt(new Date().toLocaleTimeString());
            // Fetch lock status for this table
            fetchTableLockStatus(tableName);
        } catch (error: any) {
            setPreviewDialog({ open: false, data: null });
            toast({
                variant: "destructive",
                title: t('preview_failed_title'),
                description: error.response?.data?.detail || t('preview_failed_desc'),
            });
        } finally {
            setPreviewLoading(false);
        }
    };

    const fetchTableLockStatus = async (tableName: string) => {
        try {
            const response = await api.get(`/admin/tables/${tableName}/settings`, {
                headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` }
            });
            setTableLockStatus(prev => ({ ...prev, [tableName]: response.data.is_locked }));
        } catch (error) {
            console.error("Failed to fetch table lock status", error);
        }
    };

    const handleToggleLock = async (tableName: string) => {
        try {
            const newStatus = !tableLockStatus[tableName];
            await api.put(`/admin/tables/${tableName}/settings`,
                { is_locked: newStatus },
                { headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` } }
            );
            setTableLockStatus(prev => ({ ...prev, [tableName]: newStatus }));
            toast({
                title: t('database_lock_updated'),
                description: t('database_lock_updated_desc'),
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: t('database_lock_update_failed'),
                description: error.response?.data?.detail || t('database_lock_update_error'),
            });
        }
    };

    const handleDeleteRow = async (tableName: string, rowId: number) => {
        if (!confirm(t('database_confirm_delete_row'))) {
            return;
        }
        try {
            await api.delete(`/admin/tables/${tableName}/row/${rowId}`, {
                headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` }
            });
            toast({
                title: t('database_row_deleted'),
                description: t('database_row_deleted_desc'),
            });
            // Refresh preview
            if (previewDialog.data?.table_name === tableName) {
                handlePreview(tableName);
            }
            setRefreshKey(prev => prev + 1);
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: t('database_delete_failed'),
                description: error.response?.data?.detail || t('database_delete_error'),
            });
        }
    };

    const filteredTables = tables.filter(table =>
        table.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-between items-center">
                <div className="text-start">
                    <h2 className="text-3xl font-bold tracking-tight">
                        {t('database')} {t('common_admin_label')}
                    </h2>
                    <p className="text-muted-foreground">{t('active_datasets')}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <Card className="border-primary/10">
                <CardHeader className="text-start">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            {t('datasets')}
                        </CardTitle>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('database_search_tables')}
                                    className="ps-10 w-64"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" onClick={handleBackup} disabled={backupLoading}>
                                {backupLoading ? (
                                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                                ) : (
                                    <HardDrive className="w-4 h-4 me-2" />
                                )}
                                {t('database_backup_now')}
                            </Button>
                            <Button variant="outline" className="text-primary border-primary/20 hover:bg-primary/5">
                                <Download className="w-4 h-4 me-2" />
                                {t('export_data')}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-start">{t('data_table')}</TableHead>
                                <TableHead className="text-start">{t('total_records')}</TableHead>
                                <TableHead className="text-start">{t('database_size')}</TableHead>
                                <TableHead className="text-start">{t('recent_activity')}</TableHead>
                                <TableHead className="text-start">{t('table_head_actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTables.map((table) => (
                                <TableRow key={table.name} className="hover:bg-muted/50 transition-colors">
                                    <TableCell className="font-medium text-start">
                                        <div className="flex items-center gap-2">
                                            <DatabaseIcon className="w-4 h-4 text-primary" />
                                            {table.name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-start">{table.records.toLocaleString()}</TableCell>
                                    <TableCell className="text-start">{table.size}</TableCell>
                                    <TableCell className="text-start">{table.updated}</TableCell>
                                    <TableCell className="text-start">
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handlePreview(table.name)}
                                                disabled={previewLoading}
                                            >
                                                <Eye className="w-4 h-4 me-1" />
                                                {t('database_inspect')}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleTruncateClick(table.name)}
                                            >
                                                <Trash2 className="w-4 h-4 me-1" />
                                                {t('database_truncate')}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredTables.length === 0 && !loading && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        {t('database_no_datasets_found')}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Truncate Dialog */}
            <AlertDialog open={truncateDialog.open} onOpenChange={(open) => {
                if (!open) {
                    setTruncateDialog({ open: false, tableName: null });
                    setConfirmText("");
                }
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader className="text-start">
                        <AlertDialogTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            {t('database_dangerous_operation')}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                            <p>
                                {t('database_truncate_warning')}:{" "}
                                <code className="bg-muted px-2 py-1 rounded text-primary">{truncateDialog.tableName}</code>
                            </p>
                            <p className="text-destructive font-semibold">
                                {t('database_truncate_cannot_undo')}
                            </p>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {t('database_confirm_delete')}:
                                </label>
                                <Input
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder={t('common_delete_uppercase')}
                                    className="font-mono border-destructive/30 focus-visible:ring-destructive"
                                />
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleTruncateConfirm}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={confirmText !== "DELETE" && confirmText !== t('common_delete_uppercase')}
                        >
                            {t('database_confirm_truncate')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Data Preview Dialog */}
            <Dialog open={previewDialog.open} onOpenChange={(open) => {
                if (!open) setPreviewDialog({ open: false, data: null });
            }}>
                <DialogContent className="sm:max-w-[95vw] max-w-5xl max-h-[85vh] flex flex-col p-0 border-primary/20 text-start">
                    <div className="p-6 border-b border-border text-start">
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <DatabaseIcon className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-muted-foreground block">{t('database_admin_data_explorer')}</span>
                                        <span className="text-xl font-bold">{previewDialog.data?.table_name}</span>
                                    </div>
                                </div>
                            </DialogTitle>
                        </DialogHeader>

                        <Tabs value={activeModalTab} onValueChange={setActiveModalTab} className="mt-4">
                            <TabsList className="grid w-[400px] grid-cols-2">
                                <TabsTrigger value="sample">{t('database_sample_data')}</TabsTrigger>
                                <TabsTrigger value="dictionary">{t('database_dictionary')}</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6">
                        {previewLoading ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">{t('database_fetching_preview')}</p>
                            </div>
                        ) : activeModalTab === "dictionary" ? (
                            <div className="space-y-4 py-6 text-start">
                                <div className="grid gap-4">
                                    {dictionary.length > 0 ? dictionary.map((item, idx) => (
                                        <Card key={idx} className="border-primary/10">
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
                            <div className="space-y-6 py-6 text-start">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card className="bg-primary/5 border-primary/10">
                                        <CardContent className="p-4">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('rows_label')}</span>
                                            <p className="text-2xl font-black">{(previewDialog.data.rowCount || 0).toLocaleString()}</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-primary/5 border-primary/10">
                                        <CardContent className="p-4">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('database_completeness')}</span>
                                            <p className="text-2xl font-black">{previewDialog.data.completeness}%</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-primary/5 border-primary/10">
                                        <CardContent className="p-4">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('columns_label')}</span>
                                            <p className="text-2xl font-black">{previewDialog.data.columnNames?.length || 0}</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Table Lock Toggle - Admin Only */}
                                <Card className="bg-muted/30 border-primary/10">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label htmlFor="lock-toggle" className="text-sm font-medium">
                                                    {t('database_lock_table')}
                                                </Label>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('database_lock_desc')}
                                                </p>
                                            </div>
                                            <Switch
                                                id="lock-toggle"
                                                checked={tableLockStatus[previewDialog.data.table_name] || false}
                                                onCheckedChange={() => handleToggleLock(previewDialog.data.table_name)}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="border rounded-xl bg-muted/10 overflow-hidden w-full">
                                    <div className="max-h-[45vh] overflow-y-auto overflow-x-auto w-full">
                                        <div className="min-w-full inline-block align-middle">
                                            <Table>
                                                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                                    <TableRow>
                                                        {previewDialog.data.columnNames?.map((col: string) => (
                                                            <TableHead key={col} className="text-[10px] font-bold uppercase min-w-[180px] text-start bg-background">
                                                                {col}
                                                            </TableHead>
                                                        ))}
                                                        {/* Admin-only action column */}
                                                        <TableHead className="text-[10px] font-bold uppercase min-w-[80px] sticky end-0 bg-background text-start z-20">
                                                            {t('table_head_actions')}
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {previewDialog.data.sample_data?.map((row: any, idx: number) => (
                                                        <TableRow key={idx}>
                                                            {previewDialog.data.columnNames?.map((col: string) => (
                                                                <TableCell key={col} className="text-start">
                                                                    <DataTableCell value={row[col]} columnName={col} />
                                                                </TableCell>
                                                            ))}
                                                            {/* Admin-only delete button */}
                                                            <TableCell className="sticky end-0 bg-background text-start">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                                                                    onClick={() => handleDeleteRow(previewDialog.data.table_name, row.id || idx)}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminDatabase;
