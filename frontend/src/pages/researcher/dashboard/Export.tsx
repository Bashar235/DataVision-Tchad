import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Database, Calendar, FileSpreadsheet, FileJson, FileText, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { adminExport, scheduleResearcherExport, getResearcherExportStats, getResearcherAvailableYears } from "@/services/api";
import ScheduleDialog from "@/components/ScheduleDialog";

const Export = () => {
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();
  const [exporting, setExporting] = useState(false);
  const [processingState, setProcessingState] = useState("");
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("indicators_data");
  const [selectedFormat, setSelectedFormat] = useState("csv");
  const [selectedYear, setSelectedYear] = useState("all");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [liveStats, setLiveStats] = useState({
    available_datasets: 2,
    total_records: "12,672",
    storage_percentage: "64%"
  });

  const recentExports = [
    { dataset: t('demographics_label'), format: "CSV", time: `2 ${t('overview_hours_ago')}`, status: t('status_completed') },
    { dataset: t('gdp_growth'), format: "JSON", time: `1 ${t('overview_day_ago')}`, status: t('status_completed') },
  ];

  useEffect(() => {
    fetchStats();
  }, [t]);

  const fetchStats = async () => {
    try {
      // Fetch dynamic stats from Task Engine
      const stats = await getResearcherExportStats();
      if (stats) {
        setLiveStats({
          available_datasets: stats.available_datasets,
          total_records: stats.total_records,
          storage_percentage: stats.storage_percentage
        });
      }
      const years = await getResearcherAvailableYears();
      setAvailableYears(years);
      setDatasets([
        { name: t('indicators_data_label'), key: "indicators_data", records: stats?.total_records || "12,672", lastUpdated: t('today'), size: "4 MB", format: ["CSV", "Excel", "JSON"] },
        { name: t('demographics_label'), key: "demographics", records: "1,240", lastUpdated: t('yesterday'), size: "1.2 MB", format: ["CSV", "Excel"] }
      ]);
    } catch (e) {
      console.error("Failed to load researcher export stats:", e);
      try {
        const years = await getResearcherAvailableYears();
        setAvailableYears(years);
      } catch (yearError) {
        console.error("Failed to load researcher available years:", yearError);
        setAvailableYears([]);
      }
      setDatasets([
        { name: t('indicators_data_label'), key: "indicators_data", records: "12,672", lastUpdated: t('today'), size: "4 MB", format: ["CSV", "Excel", "JSON"] },
        { name: t('demographics_label'), key: "demographics", records: "1,240", lastUpdated: t('yesterday'), size: "1.2 MB", format: ["CSV", "Excel"] }
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
      const url = window.URL.createObjectURL(new Blob([data], { type: data.type }));
      const link = document.body.appendChild(document.createElement('a'));
      link.href = url;
      const extension = format.toLowerCase() === 'excel' ? 'xlsx' : format.toLowerCase();
      link.download = `${fileName}.${extension}`;
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: t('success'), description: t('export_success_detail').replace('{dataset}', datasetKey).replace('{format}', format.toUpperCase()) });
    } catch (e) {
      toast({ title: t('error'), description: t('export_failed'), variant: "destructive" });
    } finally {
      setExporting(false);
      setProcessingState("");
    }
  };

  const handleConfirmSchedule = async (formData: { scheduledTime: string; details: string }) => {
    try {
      const customFilename = formData.details || `export_${selectedDataset}`;
      await scheduleResearcherExport(selectedFormat, selectedDataset, customFilename, formData.scheduledTime);
      toast({ 
        title: t('success'), 
        description: t('export_scheduled_success') || "Task scheduled. Monitor progress in your Profile Page." 
      });
      fetchStats(); // Update stats
    } catch (error) {
      toast({ variant: "destructive", title: t('error'), description: t('export_scheduled_failed') || "Failed to schedule." });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 mt-4 px-2">
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
        <div className="text-start">
          <h1 className="text-2xl font-bold text-foreground mb-1">{t('export_center_title')}</h1>
          <p className="text-sm text-muted-foreground">{t('export_center_subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('export_available_datasets'), value: liveStats.available_datasets, sub: t('export_ready_for_export') },
          { label: t('export_total_records'), value: liveStats.total_records, sub: t('export_across_all') },
          { label: t('export_this_month'), value: "127", sub: `+23% ${t('from_last_month')}` },
          { label: t('storage_usage'), value: liveStats.storage_percentage, sub: t('export_secure_storage') || "Secure Storage" },
        ].map((stat, i) => (
          <Card key={i} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-slate-800/40 shadow-xl rounded-2xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
            <CardHeader className="p-4 pb-1 text-start">
              <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-start">
              <div className="text-xl font-black bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">{stat.value}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-slate-800/40 shadow-xl rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-50/10 to-primary/5 transition-all duration-300">
        <CardHeader className="p-5 border-b border-border/40 text-start">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary animate-pulse" />
            {t('export_build_custom_title')}
          </CardTitle>
          <CardDescription className="text-xs">{t('export_build_custom_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block text-start">{t('export_dataset')}</label>
              <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                <SelectTrigger className="h-10 text-xs bg-background"><SelectValue /></SelectTrigger>
                <SelectContent dir={isRtl ? 'rtl' : 'ltr'}>
                  <SelectItem value="indicators_data">{t('indicators_data_label')}</SelectItem>
                  <SelectItem value="demographics">{t('demographics_label')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block text-start">{t('export_format')}</label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger className="h-10 text-xs bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block text-start">{t('export_date_range')}</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-10 text-xs bg-background"><SelectValue /></SelectTrigger>
                <SelectContent dir={isRtl ? 'rtl' : 'ltr'}>
                  <SelectItem value="all">{t('all_years')}</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={`flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/40 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Button className="flex-1 h-11 font-bold text-sm gap-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 shadow-md shadow-primary/10 transition-all active:scale-[0.98]" onClick={() => handleExport(selectedDataset, selectedFormat)} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {processingState}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {t('export_data_button')}
                </>
              )}
            </Button>
            <Button variant="outline" className="h-11 px-6 font-bold text-sm gap-2 border-primary/20 text-primary hover:bg-primary/5 shadow-sm transition-all" onClick={() => setIsExportModalOpen(true)}>
              <Calendar className="h-4 w-4" />
              {t('export_schedule')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        <div className="space-y-4">
          <CardHeader className="p-0 text-start">
            <CardTitle className="text-sm font-bold">{t('export_available_datasets')}</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {datasets.map((dataset) => (
              <Card key={dataset.key} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-slate-800/40 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden rounded-2xl">
                <CardContent className="p-0">
                  <div className={`flex items-stretch ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className="w-1.5 bg-gradient-to-b from-primary to-indigo-500" />
                    <div className="p-5 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center flex-shrink-0 border border-primary/10">
                          <Database className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-start">
                          <h3 className="font-bold text-foreground">{dataset.name}</h3>
                          <div className={`flex items-center gap-4 mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <span>{dataset.records} {t('export_records')}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {dataset.lastUpdated}</span>
                            <span>{dataset.size}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        {dataset.format.map((format: string) => {
                          const Icon = format === "CSV" ? FileText : format === "Excel" ? FileSpreadsheet : FileJson;
                          return (
                            <Button key={format} variant="outline" size="sm" onClick={() => handleExport(dataset.key, format)} className="h-9 px-3 text-[10px] font-bold gap-2 border-border hover:bg-muted/50 rounded-xl" disabled={exporting}>
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {format}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-6 text-start">
          <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-slate-800/40 shadow-xl rounded-2xl">
            <CardHeader className="p-4 border-b border-border/40">
              <CardTitle className="text-xs font-bold uppercase tracking-wider">{t('export_recent_exports')}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {recentExports.map((exp, index) => (
                <div key={index} className={`flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse text-end' : 'text-start'}`}>
                    <Download className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-[11px] font-bold text-foreground line-clamp-1">{exp.dataset}</p>
                      <p className="text-[10px] text-muted-foreground">{exp.format} • {exp.time}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-bold uppercase bg-background">{exp.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-primary/20 dark:border-primary/10 shadow-lg rounded-2xl text-start">
            <CardContent className="p-6">
              <div className={`flex items-start gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="p-2 bg-white dark:bg-slate-950 rounded-lg shadow-sm border border-primary/10"><Shield className="h-5 w-5 text-primary animate-pulse" /></div>
                <div>
                  <p className="text-xs font-bold text-primary mb-1 uppercase tracking-wide">{t('export_security_title')}</p>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {t('export_security_desc')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <ScheduleDialog isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onConfirm={handleConfirmSchedule} />
    </div>
  );
};

export default Export;
