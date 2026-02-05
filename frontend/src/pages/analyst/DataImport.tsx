import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Database, CheckCircle, AlertTriangle, AlertCircle, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { adminUpload, getAdminAudit, getDatasets } from "@/services/api";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import LanguageSwitcher from "@/components/dashboard/LanguageSwitcher";
import Papa from "papaparse";

const DataImport = () => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [category, setCategory] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importedFiles, setImportedFiles] = useState<any[]>([]);
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();

  const [validationError, setValidationError] = useState<string | null>(null);

  const categories = [
    { value: "population", label: t('reports_demographic_overview') },
    { value: "gdp", label: t('reports_socio_economic') },
    { value: "employment", label: t('employment_rate') },
    { value: "education", label: t('category_education') },
    { value: "health", label: t('category_health') },
  ];

  const SCHEMAS: Record<string, string[]> = {
    population: ['year', 'indicator_name', 'value', 'region'],
    gdp: ['year', 'gdp_value', 'sector', 'region'],
    employment: ['year', 'employment_rate', 'age_group', 'region']
  };

  const validateHeaders = (headers: string[], category: string) => {
    const required = SCHEMAS[category];
    if (!required) return true;

    const missing = required.filter(col => !headers.includes(col));
    if (missing.length > 0) {
      setValidationError(`${t('data_import_validation_error')}: ${t('data_import_expected_columns')}: [${required.join(', ')}]. ${t('data_import_missing')}: [${missing.join(', ')}].`);
      return false;
    }
    setValidationError(null);
    return true;
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
    setPreviewData([]);
    setValidationError(null);

    // Preview Logic
    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        preview: 5,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setPreviewData(results.data);
            if (category) {
              const headers = results.meta.fields || Object.keys(results.data[0] as object);
              validateHeaders(headers, category);
            }
          }
        },
        header: true,
        skipEmptyLines: true,
      });
    } else {
      setValidationError(null);
    }
  };

  useEffect(() => {
    if (selectedFile && category && selectedFile.name.endsWith(".csv") && previewData.length > 0) {
      const headers = Object.keys(previewData[0]);
      validateHeaders(headers, category);
    } else if (selectedFile && category) {
      setValidationError(null);
    }
  }, [category]);

  const uploadFiles = async () => {
    if (!selectedFile) return;
    if (!category) {
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('data_import_category_placeholder'),
      });
      return;
    }

    if (validationError) {
      toast({
        variant: "destructive",
        title: t('data_import_validation_error'),
        description: validationError,
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      await adminUpload(selectedFile, category, (percent) => {
        setProgress(percent);
      });

      toast({
        title: t('data_import_toast_success'),
        description: t('data_import_toast_desc'),
      });

      setSelectedFile(null);
      setPreviewData([]);
      setValidationError(null);
      fetchHistory(); // Refresh list

    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || t('upload_error_desc');
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: msg,
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

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

  const mainPadding = isRtl ? 'pr-[80px]' : 'pl-[80px]';

  return (
    <div className="min-h-screen bg-background text-start">
      <AnalystSidebar />
      <main className={`${mainPadding} p-6 overflow-auto transition-all duration-300`}>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center mb-6">
            <div className="text-start">
              <h2 className="text-3xl font-bold text-foreground">{t('data_import_title')}</h2>
              <p className="text-muted-foreground">{t('data_import_subtitle')}</p>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="text-start">
                  <CardTitle>{t('data_import_drag_drop')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-start">
                  <div className="space-y-2">
                    <Label>{t('data_import_select_category')}</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('data_import_category_placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {validationError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{t('data_import_validation_error')}</AlertTitle>
                      <AlertDescription>
                        {validationError}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div
                    className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors relative cursor-pointer ${dragActive ? "border-primary bg-accent" : "border-border"
                      }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => !uploading && document.getElementById('file-upload')?.click()}
                  >
                    {uploading ? (
                      <div className="space-y-4">
                        <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                        <Progress value={progress} className="w-full h-2" />
                        <p className="text-sm text-muted-foreground">{t('data_import_uploading', { progress: progress.toString() })}</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-medium text-foreground mb-2">
                          {selectedFile ? selectedFile.name : t('data_import_select_file')}
                        </p>
                        {selectedFile && (
                          <p className="text-sm text-primary font-medium mb-1">
                            {t('data_import_file_size')}: {formatFileSize(selectedFile.size)}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {t('data_import_supported_formats')}
                        </p>
                      </>
                    )}
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept=".csv,.xlsx"
                      onChange={handleFileChange}
                      disabled={uploading}
                    />
                  </div>

                  {selectedFile && !uploading && (
                    <Button className="w-full" onClick={uploadFiles}>
                      <Upload className={`w-4 h-4 ${isRtl ? 'ml-2 rotate-180' : 'mr-2'}`} />
                      {t('data_import_start_upload')}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {previewData.length > 0 && (
                <Card>
                  <CardHeader className="text-start">
                    <CardTitle>{t('database_data_preview')} ({t('database_first_five_rows')})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(previewData[0]).map((head) => (
                              <TableHead key={head} className="text-start">{head}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.map((row, i) => (
                            <TableRow key={i}>
                              {Object.values(row).map((cell: any, j) => (
                                <TableCell key={j} className="text-start">{cell}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div>
              <Card className="h-full">
                <CardHeader className="text-start">
                  <CardTitle>{t('data_import_imported_files')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {importedFiles.length > 0 ? importedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg text-start"
                      >
                        <div className="flex items-center gap-3">
                          <Database className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium text-foreground truncate max-w-[150px]" title={file.name}>{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(file.date).toLocaleDateString()} • {t(`status_${file.status.toLowerCase()}`)}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">{file.category}</p>
                          </div>
                        </div>
                        {file.status === "CLEANED" ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : file.status === "PENDING" ? (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-4">{t('database_no_recent_uploads')}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DataImport;
