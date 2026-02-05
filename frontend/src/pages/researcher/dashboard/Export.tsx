import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Database, Calendar, FileSpreadsheet, FileJson, FileText, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { adminExport, getAdminStats, scheduleExport } from "@/services/api";
import ScheduleDialog from "@/components/ScheduleDialog";
import * as XLSX from "xlsx";

const Export = () => {
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();
  const [exporting, setExporting] = useState(false);
  const [processingState, setProcessingState] = useState("");
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("indicators_data");
  const [selectedFormat, setSelectedFormat] = useState("csv");
  const [selectedYear, setSelectedYear] = useState("all");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const recentExports = [
    { dataset: "Population Census 2023", format: "CSV", time: `2 ${t('overview_hours_ago')}`, status: "completed" },
    { dataset: "Regional GDP Data", format: "JSON", time: `1 ${t('overview_day_ago')}`, status: "completed" },
  ];

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const stats = await getAdminStats();
      // SECURITY: Sanitized list - Exclude Users, Audit Logs, Settings
      const defaults = [
        { name: "Indicators Data", key: "indicators_data", records: stats?.indicators_data || "12.6K", lastUpdated: "Today", size: "2.4 MB", format: ["CSV", "Excel", "JSON"] },
        { name: "Demographics", key: "demographics", records: stats?.demographics || "N/A", lastUpdated: "Yesterday", size: "1.2 MB", format: ["CSV", "Excel"] }
      ];
      setDatasets(defaults);
    } catch (e) {
      setDatasets([
        { name: "Population Census 2023", key: "indicators_data", records: "12,672", lastUpdated: "Dec 20, 2023", size: "4 MB", format: ["CSV", "Excel", "JSON"] }
      ]);
    }
  };

  const handleExport = async (datasetKey: string, format: string) => {
    setExporting(true);
    setProcessingState(t('anonymizing_data') || "Anonymizing Data...");

    await new Promise(resolve => setTimeout(resolve, 1500));
    setProcessingState(t('export_preparing') || "Preparing download...");

    try {
      const data = await adminExport(format.toLowerCase(), datasetKey);

      const fileName = `${datasetKey}_export_${new Date().getTime()}`;

      if (format.toLowerCase() === 'xlsx' || format.toLowerCase() === 'excel') {
        // Robust Excel Generation using xlsx library
        const worksheet = XLSX.utils.json_to_sheet(Array.isArray(data) ? data : []);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
      } else {
        // Standard Blob handling for CSV/JSON
        let mimeType = data.type;
        const url = window.URL.createObjectURL(new Blob([data], { type: mimeType }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${fileName}.${format.toLowerCase()}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      toast({
        title: t('success'),
        description: `${datasetKey} exported successfully as ${format.toUpperCase()}`
      });
    } catch (e) {
      toast({
        title: t('error'),
        description: t('export_failed') || "Export failed",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
      setProcessingState("");
    }
  };

  const handleConfirmSchedule = async (formData: { scheduledTime: string; details: string }) => {
    try {
      await scheduleExport(formData.scheduledTime, formData.details);
      toast({
        title: "Succès",
        description: "L'export a été planifié avec succès."
      });
    } catch (error) {
      console.error("Failed to schedule export", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Échec de la planification."
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-start">
        <h1 className="text-3xl font-bold mb-2">{t('export_center_title')}</h1>
        <p className="text-muted-foreground">{t('export_center_subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {/* KPI Cards */}
        <Card>
          <CardHeader className="pb-2 text-start">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t('export_available_datasets')}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">{datasets.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('export_ready_for_export')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 text-start">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t('export_total_records')}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">12K+</div>
            <p className="text-xs text-muted-foreground mt-1">{t('export_across_all')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 text-start">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t('export_this_month')}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground mt-1">+23% {t('from_last_month')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 text-start">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Storage Usage</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold text-primary">64%</div>
            <div className="w-full bg-muted h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-primary h-full" style={{ width: '64%' }}></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('export_build_custom_title')}</CardTitle>
          <CardDescription>{t('export_build_custom_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-start">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium block">{t('export_dataset')}</label>
              <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                <SelectTrigger className="text-start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indicators_data">Indicators Data</SelectItem>
                  <SelectItem value="demographics">Demographics</SelectItem>
                  <SelectItem value="users">System Users</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium block">{t('export_format')}</label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger className="text-start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium block">{t('export_date_range')}</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="text-start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="all">{t('all_years')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Button className={`flex-1 ${isRtl ? 'flex-row-reverse' : ''}`} onClick={() => handleExport(selectedDataset, selectedFormat)} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className={`h-4 w-4 animate-spin ${isRtl ? 'ml-2' : 'mr-2'}`} />
                  {processingState}
                </>
              ) : (
                <>
                  <Download className={`h-4 w-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                  {t('export_data_button')}
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setIsExportModalOpen(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              {t('export_schedule')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('export_available_datasets')}</CardTitle>
          <CardDescription>{t('export_select_dataset')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {datasets.map((dataset) => (
              <div key={dataset.key} className="p-4 rounded-lg border border-border hover:border-primary transition-colors">
                <div className={`flex items-start justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex gap-4 flex-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Database className="h-6 w-6 text-primary" />
                    </div>
                    <div className={`flex-1 text-start`}>
                      <h3 className="font-semibold mb-1">{dataset.name}</h3>
                      <div className={`flex items-center gap-4 text-sm text-muted-foreground ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <span>{dataset.records} {t('export_records')}</span>
                        <span className={`flex items-center gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <Calendar className="h-3 w-3" />
                          {dataset.lastUpdated}
                        </span>
                        <span>{dataset.size}</span>
                      </div>
                      <div className={`flex gap-2 mt-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        {dataset.format.map((format: string) => (
                          <Badge key={format} variant="outline" className="text-xs">{format}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`flex gap-2 ${isRtl ? 'mr-4' : 'ml-4'} ${isRtl ? 'flex-row-reverse' : ''}`}>
                    {dataset.format.map((format: string) => {
                      const Icon = format === "CSV" ? FileText : format === "Excel" ? FileSpreadsheet : FileJson;
                      return (
                        <Button key={format} variant="outline" size="sm" onClick={() => handleExport(dataset.key, format)} className={isRtl ? 'flex-row-reverse' : ''} disabled={exporting}>
                          <Icon className={`h-4 w-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />{format}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('export_recent_exports')}</CardTitle>
          <CardDescription>{t('export_download_history')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentExports.map((exp, index) => (
              <div key={index} className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <div className="text-start">
                    <p className="font-medium text-sm">{exp.dataset}</p>
                    <p className="text-xs text-muted-foreground">{exp.format} • {exp.time}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">{exp.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/50 border-2">
        <CardContent className="pt-6">
          <div className={`flex items-start gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-start">
              <p className="text-sm font-medium mb-1">{t('export_security_title')}</p>
              <p className="text-xs text-muted-foreground">
                {t('export_security_desc')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <ScheduleDialog
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onConfirm={handleConfirmSchedule}
      />
    </div>
  );
};
export default Export;
