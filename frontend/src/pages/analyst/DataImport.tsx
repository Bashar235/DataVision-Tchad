import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Database, CheckCircle, AlertTriangle, AlertCircle, XCircle, FileText, FileSpreadsheet, FileJson, Play, Activity, Brain, Download } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDatasets, adminUpload, preFlightCheck, logAIRepairDecision } from "@/services/api";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Papa from "papaparse";
import * as xlsx from "xlsx";
import { useNavigate } from "react-router-dom";

type ImportStage = "IDLE" | "CHECKING" | "HEALTH_REPORT" | "UPLOADING" | "ABORTED";

interface HealthError {
  line: number;
  column: string;
  original_value: string;
  error_type: "FORMAT" | "MISSING" | "LOGICAL";
}

interface SchemaError {
  column: string;
  label: string;
  message: string;
}

interface HealthReport {
  total_errors: number;
  format_errors: number;
  missing_errors: number;
  logical_errors: number;
  errors: HealthError[];
  filename: string;
  category: string;
  row_count: number;
  col_count: number;
  ml_compatible: boolean;
  schema_errors: SchemaError[];
  injected_columns?: string[];
  smart_schema?: {
    injected_columns?: string[];
    missing_required?: string[];
    default_value?: number | null;
  };
}

const DataImport = () => {
  const [stage, setStage] = useState<ImportStage>("IDLE");
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [category, setCategory] = useState("");
  const [fileType, setFileType] = useState("auto");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importedFiles, setImportedFiles] = useState<any[]>([]);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();

  const [validationError, setValidationError] = useState<string | null>(null);

  const categories = [
    { value: "census", label: `${t('census_label')} (${t('data_import_census_columns_hint', { defaultValue: 'needs: year, province, gender, age_group, population, ISF, e0, TMI, Cc, Cm' })})` },
    { value: "health", label: t('health_label') },
    { value: "economy", label: t('economy_label') },
  ];

  const getColLabel = (col: string) => {
    const key = `col_label_${col.toLowerCase().replace(' (or region)', '')}`;
    const localized = t(key);
    return localized !== key ? `${col} (${localized})` : col;
  };

  // 10-column ML template. Province may also be supplied as region.
  const STANDARD_CENSUS_TEMPLATE = ['year', 'province', 'gender', 'age_group', 'population', 'ISF', 'e0', 'TMI', 'Cc', 'Cm'];
  const CENSUS_REQUIRED = ['year', 'gender', 'age_group', 'population', 'ISF', 'e0', 'TMI', 'Cc', 'Cm'];
  const GEO_ALIASES = ['province', 'region'];

  const SCHEMAS: Record<string, string[]> = {
    census: STANDARD_CENSUS_TEMPLATE,
    health: ['year', 'region', 'population'],
    economy: ['Region', 'Year', 'GDP_Per_Capita', 'Urbanization_Rate']
  };

  const validateHeaders = (headers: string[], cat: string) => {
    if (cat !== 'census') {
      const required = SCHEMAS[cat];
      if (!required) return true;
      const hs = headers.map(h => h.trim().toLowerCase());
      const missing = required.filter(col => !hs.includes(col.toLowerCase()));
      if (missing.length > 0) {
        setValidationError(t('data_import_error_missing_cols', { expected: required.join(', '), missing: missing.join(', ') }));
        return false;
      }
      setValidationError(null);
      return true;
    }

    // Census: check geo column (province OR region) + numeric columns
    const hs = headers.map(h => h.trim().toLowerCase());
    const hasGeo = GEO_ALIASES.some(alias => hs.includes(alias.toLowerCase()));
    const missing: string[] = [];
    if (!hasGeo) missing.push('province (or region)');
    for (const col of CENSUS_REQUIRED) {
      if (!hs.includes(col.toLowerCase())) missing.push(col);
    }
    if (missing.length > 0) {
      setValidationError(
        t('data_import_census_validation_msg', { missing: missing.join(', ') })
      );
      return false;
    }
    setValidationError(null);
    return true;
  };

  const downloadStandardizedTemplate = () => {
    const sampleRow = ['2024', "N'Djamena", 'M', '25-64', '1500000', '4.2', '62.5', '48.0', '18.0', '54.0'];
    const csv = `${STANDARD_CENSUS_TEMPLATE.join(',')}\r\n${sampleRow.join(',')}\r\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'datavision_standardized_census_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchHistory = async () => {
    try {
      const data = await getDatasets();
      setImportedFiles(data.slice(0, 10));
    } catch (error) {
      console.error("Failed to fetch history", error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setParsedData([]);
    setValidationError(null);
    setHealthReport(null);
    setStage("IDLE");

    const detectedExt = file.name.split('.').pop()?.toLowerCase();
    const ext = fileType === "auto" ? detectedExt : fileType;

    if (ext === "csv") {
      Papa.parse(file, {
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setParsedData(results.data);
            if (category) {
              const headers = results.meta.fields || Object.keys(results.data[0] as object);
              validateHeaders(headers, category);
            }
          }
        },
        header: true,
        skipEmptyLines: true,
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = xlsx.read(data, { type: 'array' });
          if (workbook.SheetNames.length > 1) {
            sessionStorage.setItem("pendingCleaningWarnings", t('data_import_multi_sheet_warning', { sheet: workbook.SheetNames[0] }));
          } else {
            sessionStorage.removeItem("pendingCleaningWarnings");
          }
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = xlsx.utils.sheet_to_json(firstSheet, { defval: "" });
          setParsedData(json);
          if (category && json.length > 0) {
              validateHeaders(Object.keys(json[0] as object), category);
          }
        } catch (err) {
          setValidationError(t('data_import_excel_read_error'));
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast({
        variant: "destructive",
        title: t('data_import_format_unsupported_title'),
        description: t('data_import_format_unsupported_desc')
      });
      setSelectedFile(null);
    }
  };

  useEffect(() => {
    if (selectedFile && category && selectedFile.name.endsWith(".csv") && parsedData.length > 0) {
      const headers = Object.keys(parsedData[0]);
      validateHeaders(headers, category);
    } else if (selectedFile && category) {
      setValidationError(null);
    }
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith('.csv')) return <FileText className="w-10 h-10 mx-auto mb-4 text-blue-500" />;
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) return <FileSpreadsheet className="w-10 h-10 mx-auto mb-4 text-emerald-500" />;
    return <Upload className="w-10 h-10 mx-auto mb-4 text-primary" />;
  };

  const runPreFlightCheck = async () => {
    if (!selectedFile) return;
    if (!category) {
      toast({ variant: "destructive", title: t('common_error'), description: t('data_import_select_category_error') });
      return;
    }
    if (validationError) {
      toast({ variant: "destructive", title: t('data_import_schema_error_toast'), description: validationError });
      return;
    }

    setStage("CHECKING");
    setProgress(30);

    try {
      const report = await preFlightCheck(selectedFile, category);
      setProgress(100);
      setHealthReport(report);
      setTimeout(() => setStage("HEALTH_REPORT"), 500);
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: t('data_import_preflight_failed'), 
        description: error.response?.data?.detail || t('data_import_analysis_error')
      });
      setStage("IDLE");
    }
  };

  const handleAIRepair = async () => {
    if (!selectedFile || !healthReport) return;

    setStage("UPLOADING");
    setProgress(0);

    try {
      // 1. Actually upload the file to DB
      const result = await adminUpload(selectedFile, category, (p) => setProgress(p));
      const datasetId = result.id;
      
      // 2. Log the Analyst's human-in-the-loop decision
      if (healthReport.format_errors > 0) {
        await logAIRepairDecision(datasetId, selectedFile.name, healthReport.format_errors);
      }

      // 3. Cache in Session for identification
      sessionStorage.setItem("pendingCleaningCategory", category);
      sessionStorage.setItem("pendingCleaningFilename", selectedFile.name);
      sessionStorage.setItem("pendingCleaningId", datasetId); // UUID string
      
      toast({ 
        title: t('data_import_auth_granted'), 
        description: t('data_import_sending_to_console'),
        className: "bg-green-500 text-white" 
      });
      setTimeout(() => navigate(`/analyst/cleaning-console/${datasetId}`), 1000);
      
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: t('data_import_import_error'), 
        description: error.response?.data?.detail || t('data_import_server_send_error')
      });
      setStage("HEALTH_REPORT"); // fall back
    }
  };

  const handleAbort = () => {
    setStage("ABORTED");
    setSelectedFile(null);
    setParsedData([]);
    setHealthReport(null);
    toast({
      title: t('data_import_cancelled'),
      description: t('data_import_cancel_desc'),
    });
    setTimeout(() => setStage("IDLE"), 500);
  };

  const getErrorBadge = (type: string) => {
    switch (type) {
      case "FORMAT":
        return <Badge className="bg-orange-500 hover:bg-orange-600">{t('data_import_badge_format')}</Badge>;
      case "MISSING":
        return <Badge variant="destructive">{t('data_import_badge_missing')}</Badge>;
      case "LOGICAL":
        return <Badge className="bg-purple-500 hover:bg-purple-600">{t('data_import_badge_logical')}</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 mt-4 px-2">
      <div className="flex justify-between items-center mb-6">
        <div className="text-start">
          <h2 className="text-2xl font-bold text-foreground">{t('data_import_page_title')}</h2>
          <p className="text-muted-foreground">{t('data_import_page_subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* STAGE: IDLE or CHECKING */}
          {(stage === "IDLE" || stage === "CHECKING" || stage === "UPLOADING") && (
            <Card className="shadow-sm">
              <CardHeader className="text-start">
                <CardTitle>{t('data_import_file_selection')}</CardTitle>
                <CardDescription>{t('data_import_no_data_saved_notice')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-start">
                <div className="space-y-2">
                  <Label>{t('data_import_data_category')}</Label>
                  <Select value={category || undefined} onValueChange={setCategory} disabled={stage !== "IDLE"}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder={t('data_import_select_data_type')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('data_import_file_type', { defaultValue: 'File Type' })}</Label>
                  <Select value={fileType} onValueChange={setFileType} disabled={stage !== "IDLE"}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Select File Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t('data_import_file_type_auto', { defaultValue: 'Auto-detect from extension' })}</SelectItem>
                      <SelectItem value="csv">CSV (.csv)</SelectItem>
                      <SelectItem value="xlsx">Excel (.xlsx, .xls)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/20 p-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={downloadStandardizedTemplate}
                    disabled={stage !== "IDLE"}
                  >
                    <Download className="w-4 h-4" />
                    {t('data_import_standard_template', { defaultValue: 'Standardized CSV Template' })}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {STANDARD_CENSUS_TEMPLATE.join(', ')}
                  </span>
                </div>

                {validationError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t('data_import_schema_error_title')}</AlertTitle>
                    <AlertDescription>{validationError}</AlertDescription>
                  </Alert>
                )}

                <div
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors relative cursor-pointer ${
                    dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  } ${(stage !== "IDLE" || validationError) ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => stage === "IDLE" && document.getElementById('file-upload')?.click()}
                >
                  {(stage === "CHECKING" || stage === "UPLOADING") ? (
                    <div className="space-y-4">
                      <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
                      <Progress value={progress} className="w-full h-1.5" />
                      <p className="text-sm font-semibold text-primary">
                        {stage === "CHECKING" ? t('data_import_engine_analyzing') : t('data_import_secure_saving')}
                      </p>
                    </div>
                  ) : (
                    <>
                      {selectedFile ? getFileIcon(selectedFile.name) : <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground/60" />}
                      <p className="text-base font-semibold text-foreground mb-1">
                        {selectedFile ? selectedFile.name : t('data_import_drag_or_browse')}
                      </p>
                      {selectedFile && (
                        <p className="text-xs text-primary font-medium mb-1">
                          {t('data_import_file_size_label')} {formatFileSize(selectedFile.size)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        .csv, .xlsx
                      </p>
                    </>
                  )}
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={stage !== "IDLE"}
                  />
                </div>

                {selectedFile && stage === "IDLE" && (
                  <Button 
                    className="w-full font-bold h-12 gap-2" 
                    size="lg" 
                    onClick={runPreFlightCheck} 
                    disabled={!!validationError}
                  >
                    <Activity className="w-5 h-5" />
                    {t('data_import_launch_audit')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* STAGE: HEALTH REPORT */}
          {stage === "HEALTH_REPORT" && healthReport && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <Card className="border-primary/20 shadow-md">
                <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
                  <div className="flex items-center gap-3">
                    <Activity className="w-6 h-6 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{t('data_import_health_dashboard')} {healthReport.filename}</CardTitle>
                      <CardDescription className="font-medium text-foreground">
                        {t('data_import_rows_analyzed', { count: healthReport.row_count })}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  
                  {/* Summary Stats Grid */}
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="p-4 rounded-xl bg-muted/30 border border-border">
                      <p className="text-sm text-muted-foreground font-medium mb-1">{t('data_import_total_errors')}</p>
                      <p className="text-3xl font-bold">{healthReport.total_errors}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/30">
                      <p className="text-sm text-orange-600 dark:text-orange-400 font-medium mb-1">{t('common_format')}</p>
                      <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{healthReport.format_errors}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-red-50 border border-red-100 dark:bg-red-950/20 dark:border-red-900/30">
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">{t('cleaning_missing')}</p>
                      <p className="text-3xl font-bold text-red-700 dark:text-red-300">{healthReport.missing_errors}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-purple-50 border border-purple-100 dark:bg-purple-950/20 dark:border-purple-900/30">
                      <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">{t('cleaning_logical')}</p>
                      <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{healthReport.logical_errors}</p>
                    </div>
                  </div>

                  {healthReport.format_errors > 0 && (
                    <Alert className="bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900">
                      <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      <AlertTitle className="text-orange-800 dark:text-orange-300 font-bold">{t('data_import_format_warning_title')}</AlertTitle>
                      <AlertDescription className="text-orange-700 dark:text-orange-200/80">
                        {t('data_import_format_warning_desc', { count: healthReport.format_errors })}
                      </AlertDescription>
                    </Alert>
                  )}

                  {((healthReport.injected_columns?.length || healthReport.smart_schema?.injected_columns?.length || 0) > 0) && (
                    <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
                      <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <AlertTitle className="text-blue-800 dark:text-blue-300 font-bold">
                        {t('data_import_smart_schema_title', { defaultValue: 'Smart Schema Applied' })}
                      </AlertTitle>
                      <AlertDescription className="text-blue-700 dark:text-blue-200/80">
                        {t('data_import_smart_schema_desc', {
                          defaultValue: `Added missing indicators: ${(healthReport.injected_columns || healthReport.smart_schema?.injected_columns || []).join(', ')}`,
                          columns: (healthReport.injected_columns || healthReport.smart_schema?.injected_columns || []).join(', ')
                        })}
                      </AlertDescription>
                    </Alert>
                  )}

                  {healthReport.total_errors === 0 && (
                    <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <AlertTitle className="text-green-800 dark:text-green-300 font-bold">{t('data_import_validated_title')}</AlertTitle>
                      <AlertDescription className="text-green-700 dark:text-green-200/80">
                        {t('data_import_validated_desc')}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* ML Compatibility Diagnostic (New) */}
                  {healthReport.category === "census" && (
                    <Alert className={healthReport.ml_compatible ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"}>
                      <Brain className={`h-5 w-5 ${healthReport.ml_compatible ? "text-emerald-600" : "text-red-600"}`} />
                      <AlertTitle className={`font-bold ${healthReport.ml_compatible ? "text-emerald-800" : "text-red-800"}`}>
                        {healthReport.ml_compatible ? t('data_import_ai_compatible_title') : t('data_import_ai_incompatible_title')}
                      </AlertTitle>
                      <AlertDescription className={healthReport.ml_compatible ? "text-emerald-700" : "text-red-700"}>
                        {healthReport.ml_compatible 
                          ? t('data_import_ai_compatible_desc')
                          : t('data_import_census_unusable', { columns: healthReport.schema_errors.map(e => e.label).join(", ") })
                        }
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Decision Fork */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t border-border mt-6">
                    <Button 
                      className="flex-1 h-14 text-base font-bold shadow-lg shadow-primary/20"
                      onClick={handleAIRepair}
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      {healthReport.format_errors > 0 ? t('data_import_start_ai_repair') : t('data_import_start_import_clean')}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 h-14 text-base font-bold border-destructive text-destructive hover:bg-destructive/10"
                      onClick={handleAbort}
                    >
                      <XCircle className="w-5 h-5 mr-2" />
                      {t('data_import_abort_manual')}
                    </Button>
                  </div>

                </CardContent>
              </Card>

              {/* Error Grid */}
              {healthReport.errors.length > 0 && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      {t('data_import_diagnostic_grid')} ({healthReport.errors.length} {t('modal_anomalies_label')})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[350px] overflow-y-auto w-full">
                      <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                          <TableRow>
                            <TableHead className="w-20 text-center">{t('data_import_row_label')}</TableHead>
                            <TableHead>{t('data_import_column_label')}</TableHead>
                            <TableHead>{t('data_import_original_value')}</TableHead>
                            <TableHead>{t('data_import_error_type')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {healthReport.errors.slice(0, 100).map((err, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-center font-mono text-muted-foreground text-xs">{err.line}</TableCell>
                              <TableCell className="font-medium text-sm">{err.column}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {err.original_value === "" ? (
                                  <span className="text-muted-foreground italic">{t('data_import_empty_label')}</span>
                                ) : (
                                  <span className="bg-muted px-1.5 py-0.5 rounded text-foreground">{err.original_value}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {getErrorBadge(err.error_type)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {healthReport.errors.length > 100 && (
                        <div className="p-3 text-center text-xs text-muted-foreground bg-muted/20 border-t border-border">
                          {t('data_import_display_limit')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Recent Files Sidebar */}
        <div>
          <Card className="h-full shadow-sm">
            <CardHeader className="text-start">
              <CardTitle className="text-sm">{t('data_import_recent_files')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {importedFiles.length > 0 ? importedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg text-start bg-muted/20"
                  >
                    <div className="flex items-center gap-3">
                      <Database className="w-4 h-4 text-primary" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-medium text-foreground truncate w-[130px]">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{file.category}</p>
                      </div>
                    </div>
                    {file.status === "Cleaned" || file.status === "CLEANED" ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 px-2 text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1"
                        onClick={() => navigate(`/analyst/cleaning-console/${file.id}`)}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        {t('data_import_view_btn')}
                      </Button>
                    )}
                  </div>
                )) : (
                  <p className="text-xs text-muted-foreground text-center py-4">{t('data_import_no_recent')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DataImport;
