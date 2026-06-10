import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Calendar, Eye, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  generateResearcherReport, 
  getReportHistory, 
  downloadReport, 
  previewReport,
  getRegions,
  getDatasets 
} from "@/services/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Reports = () => {
  const { toast } = useToast();
  const { t, isRtl, currentLang } = useLanguage();
  const [reports, setReports] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedVisualizations, setSelectedVisualizations] = useState<string[]>([]);
  const [selectedFormat, setSelectedFormat] = useState("pdf");
  const [selectedLanguage, setSelectedLanguage] = useState(currentLang || "fr");

  // Filters State
  const [regions, setRegions] = useState<string[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("Tchad");
  const [selectedDataset, setSelectedDataset] = useState("35949ad2-8b2e-5123-bd6a-2dd65a98a9d3");
  const [startYear, setStartYear] = useState(2009);
  const [endYear, setEndYear] = useState(2050);

  const QUINQUENNIAL_YEARS = [2009, 2014, 2019, 2024, 2029, 2034, 2039, 2044, 2049, 2050];
  const startYearOptions = QUINQUENNIAL_YEARS.filter(y => y < 2050);
  const endYearOptions = QUINQUENNIAL_YEARS.filter(y => 
    y > startYear && (
      y === 2050 
        ? (y - startYear) % 5 === 1 
        : (y - startYear) % 5 === 0
    )
  );
  const isValidRange = endYear > startYear && (
    endYear === 2050 
      ? (endYear - startYear) % 5 === 1 
      : (endYear - startYear) % 5 === 0
  );

  const handleStartYearChange = (val: number) => {
    setStartYear(val);
    const isEndValid = val < endYear && (
      endYear === 2050
        ? (endYear - val) % 5 === 1
        : (endYear - val) % 5 === 0
    );
    if (!isEndValid) {
      const nextVal = val + 5;
      setEndYear(nextVal > 2050 ? 2050 : nextVal);
    }
  };

  const totalSelected = selectedSections.length + selectedVisualizations.length;
  const isReadyToPublish = totalSelected >= 3;


  // Sections config
  const dataSections = [
    { id: 'executive_summary', label: t('dashboard_overview') },
    { id: 'demographics', label: t('demographics') },
    { id: 'trends', label: t('analytics_growth_trajectories') || t('population_trend') },
    { id: 'health_audit', label: t('quality_audit') || t('data_health_dashboard') }
  ];

  const vizOptions = [
    { id: 'pyramid', label: t('age_distribution') },
    { id: 'predictive', label: t('side_nav_predictive_analytics') }
  ];

  useEffect(() => {
    fetchHistory();
    const loadFilters = async () => {
      try {
        const [fetchedRegions, fetchedDatasets] = await Promise.all([
          getRegions(),
          getDatasets()
        ]);
        setRegions(fetchedRegions.filter((r: string) => r.toLowerCase() !== "national"));
        setDatasets(fetchedDatasets.filter((d: any) => d.status === "Cleaned" || d.status === "Published"));
      } catch (err) {
        console.error("Failed to load report filter data", err);
      }
    };
    loadFilters();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await getReportHistory();
      if (data && Array.isArray(data) && data.length > 0) {
        const mappedData = data.map((r: any) => ({
          ...r,
          title: r.report_type || r.filename || t('untitled_report'),
          date: r.timestamp ? new Date(r.timestamp).toLocaleDateString(t('common_lang_code') || 'fr-FR') : t('unknown_date')
        }));
        setReports(mappedData);
      } else {
        setReports([
          { id: 1, title: t('indicators_data_label'), description: t('comprehensive_analysis') || "Analysis", date: "15/12/2023", pages: 24, status: t('status_completed'), downloads: 45, filename: "report1.pdf" },
          { id: 2, title: t('employment_rate'), description: t('labor_force_stats') || "Stats", date: "28/11/2023", pages: 18, status: t('status_completed'), downloads: 32, filename: "report2.pdf" },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch reports", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDownload = async (filename: string, reportTitle: string) => {
    if (!filename) {
      toast({ title: t('error'), description: t('error_filename_missing'), variant: "destructive" });
      return;
    }
    toast({ title: t('reports_download_started'), description: `${t('reports_downloading')} "${reportTitle}"` });
    try {
      const blob = await downloadReport(filename);
      const url = window.URL.createObjectURL(blob);
      const link = document.body.appendChild(document.createElement('a'));
      link.href = url;
      link.download = filename;
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: t('error'), description: t('error_download_failed'), variant: "destructive" });
    }
  };

  const handlePreview = async (filename: string, reportTitle: string) => {
    toast({ title: t('reports_opening_preview'), description: `${t('reports_loading')} "${reportTitle}"` });
    try {
      await previewReport(filename);
    } catch (e) {
      toast({ title: t('error'), description: t('error_preview_failed'), variant: "destructive" });
    }
  };

  const toggleSection = (id: string) => {
    setSelectedSections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleViz = (id: string) => {
    setSelectedVisualizations(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleGenerateCustom = async () => {
    if (selectedSections.length === 0 && selectedVisualizations.length === 0) {
      toast({ title: t('error'), description: t('error_select_section'), variant: "destructive" });
      return;
    }
    
    // Safety check: Validate the 5-year quinquennial gap
    if (!isValidRange) {
      toast({
        title: t('error'),
        description: currentLang === 'en'
          ? "INSEED reporting standards require intervals to be in 5-year blocks (e.g., 2009-2014)."
          : currentLang === 'ar'
          ? "تتطلب معايير إعداد تقارير INSEED أن تكون الفترات في كتل مدتها 5 سنوات (على سبيل المثال، 2009-2014)."
          : "Les normes de reporting de l'INSEED exigent des intervalles par blocs de 5 ans (ex. 2009-2014).",
        variant: "destructive"
      });
      return;
    }

    setGenerating(true);
    toast({ title: t('generating_report'), description: t('please_wait') });

    // Map UI sections to backend expected sections:
    // 'executive_summary' -> 'Overview'
    // 'demographics' -> 'Demographics'
    // 'trends' -> 'Growth'
    // 'health_audit' -> 'Quality'
    // 'pyramid' -> 'Age'
    // 'predictive' -> 'Predictive'
    const backendSections = [...selectedSections, ...selectedVisualizations].map(id => {
      if (id === 'executive_summary') return 'Overview';
      if (id === 'demographics') return 'Demographics';
      if (id === 'trends') return 'Growth';
      if (id === 'health_audit') return 'Quality';
      if (id === 'pyramid') return 'Age';
      if (id === 'predictive') return 'Predictive';
      return id;
    });

    try {
      const blob = await generateResearcherReport({
        sections: backendSections,
        format: selectedFormat.toUpperCase(),
        language: selectedLanguage,
        filters: {
          dataset_id: selectedDataset,
          region: selectedRegion,
          start_year: startYear,
          end_year: endYear
        }
      });
      const filename = `DataVision_Tchad_Custom_${new Date().toISOString().split('T')[0]}.${selectedFormat}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.body.appendChild(document.createElement('a'));
      link.href = url;
      link.download = filename;
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: t('success'), description: t('success_report_generated') });
      fetchHistory();
    } catch (e) {
      toast({ title: t('error'), description: t('error_generate_report'), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 mt-4 px-2">
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
        <div className="text-start">
          <h1 className="text-2xl font-bold text-foreground">{t('reports_library_title')}</h1>
          <p className="text-sm text-muted-foreground">{t('reports_library_subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button className={`gap-2 h-10 ${isRtl ? 'flex-row-reverse' : ''}`} onClick={handleGenerateCustom} disabled={generating || !isValidRange}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            <span>{t('reports_generate_new')}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('reports_total_reports'), value: reports.length, sub: `+18 ${t('reports_this_month')}` },
          { label: t('reports_total_downloads'), value: "1,847", sub: `+245 ${t('reports_this_month')}` },
          { label: t('reports_avg_pages'), value: "22", sub: t('reports_per_report') },
          { label: t('reports_most_popular'), value: t('population_forecast'), sub: `58 ${t('reports_downloads')}` },
        ].map((stat, i) => (
          <Card key={i} className="border-border/60 shadow-sm">
            <CardHeader className="p-4 pb-1 text-start">
              <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-start">
              <div className="text-xl font-black text-foreground">{stat.value}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-primary/30" /></div>
          ) : reports.map((report) => (
            <Card key={report.id} className="border-border/40 shadow-sm hover:shadow-md transition-all group overflow-hidden">
              <CardContent className="p-0">
                <div className={`flex items-stretch ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className="w-1.5 bg-primary/20 group-hover:bg-primary transition-colors" />
                  <div className="p-5 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center flex-shrink-0 border border-primary/10">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-start">
                        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{report.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">{report.description || report.filename}</p>
                        <div className={`flex items-center gap-4 mt-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {report.date}</span>
                          <span>{report.pages || 12} {t('reports_pages')}</span>
                          <span>{report.downloads || 0} {t('reports_downloads')}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Button variant="ghost" size="sm" onClick={() => handlePreview(report.filename, report.title)} className="h-9 px-3 text-xs gap-2">
                        <Eye className="h-3.5 w-3.5" /> {t('reports_preview')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDownload(report.filename, report.title)} className="h-9 px-3 text-xs gap-2 border-primary/20 text-primary hover:bg-primary/5">
                        <Download className="h-3.5 w-3.5" /> {t('reports_download')}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="bg-white/70 backdrop-blur-md dark:bg-black/40 border-primary/20 shadow-xl overflow-hidden text-start">
            <CardHeader className="p-5 border-b border-primary/10 bg-primary/5">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  {t('reports_custom_builder_title')}
                </CardTitle>
                {isReadyToPublish ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] px-2 py-0.5 transition-all duration-300">
                    {t('report_ready_publish')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px] px-2 py-0.5 transition-all duration-300">
                    {t('report_select_sections_warn')}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs mt-1">{t('reports_custom_builder_subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              
              {/* Dataset selection */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider">{t('gen_rep_dataset_source')}</h4>
                <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                  <SelectTrigger className="w-full bg-background border border-border/40 text-xs">
                    <SelectValue placeholder={t('select_dataset')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="35949ad2-8b2e-5123-bd6a-2dd65a98a9d3">{t('inseed_gold_standard')}</SelectItem>
                    {datasets.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.filename}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Region selection */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider">{t('gen_rep_regional_focus')}</h4>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="w-full bg-background border border-border/40 text-xs">
                    <SelectValue placeholder={t('select_region')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tchad">{t('national_tchad')}</SelectItem>
                    {regions.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year range selection */}
              <div className="space-y-2 pt-1">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider">{t('year_range')}</h4>
                <div className="flex gap-2 items-center">
                  <Select value={String(startYear)} onValueChange={(val) => handleStartYearChange(Number(val))}>
                    <SelectTrigger className="flex-1 bg-background border border-border/40 text-xs h-8">
                      <SelectValue placeholder={t('start')} />
                    </SelectTrigger>
                    <SelectContent>
                      {startYearOptions.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-xs">{t('to')}</span>
                  <Select value={String(endYear)} onValueChange={(val) => setEndYear(Number(val))}>
                    <SelectTrigger className="flex-1 bg-background border border-border/40 text-xs h-8">
                      <SelectValue placeholder={t('end')} />
                    </SelectTrigger>
                    <SelectContent>
                      {endYearOptions.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!isValidRange && (
                  <div dir={isRtl ? "rtl" : "ltr"} className={`mt-2 p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive ${isRtl ? "text-right" : "text-left"}`}>
                    <p className="text-[11px] font-medium leading-normal">
                      {currentLang === 'ar' ? (
                        <span>
                          تتطلب معايير إعداد تقارير INSEED أن تكون الفترات في كتل مدتها 5 سنوات (على سبيل المثال، <span dir="ltr" className="inline-block font-mono font-semibold">2009-2014</span>).
                        </span>
                      ) : currentLang === 'en' ? (
                        <span>
                          INSEED reporting standards require intervals to be in 5-year blocks (e.g., <span dir="ltr" className="inline-block font-mono font-semibold">2009-2014</span>).
                        </span>
                      ) : (
                        <span>
                          Les normes de reporting de l'INSEED exigent des intervalles par blocs de 5 ans (ex. <span dir="ltr" className="inline-block font-mono font-semibold">2009-2014</span>).
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider">{t('reports_select_data_sections')}</h4>
                <div className="space-y-2">
                  {dataSections.map((section) => (
                    <label key={section.id} className={`flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-background cursor-pointer hover:border-primary/40 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <input type="checkbox" className="w-3.5 h-3.5 rounded-sm border-primary/20 text-primary" checked={selectedSections.includes(section.id)} onChange={() => toggleSection(section.id)} />
                      <span className="text-xs font-medium">{section.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider">{t('reports_visualization_options')}</h4>
                <div className="space-y-2">
                  {vizOptions.map((option) => (
                    <label key={option.id} className={`flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-background cursor-pointer hover:border-primary/40 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <input type="checkbox" className="w-3.5 h-3.5 rounded-sm border-primary/20 text-primary" checked={selectedVisualizations.includes(option.id)} onChange={() => toggleViz(option.id)} />
                      <span className="text-xs font-medium">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider">{t('report_format_label')}</h4>
                <div className={`flex gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <Button variant={selectedFormat === 'pdf' ? 'default' : 'outline'} size="sm" className="flex-1 text-[10px] h-8" onClick={() => setSelectedFormat('pdf')}>PDF</Button>
                  <Button variant={selectedFormat === 'xlsx' ? 'default' : 'outline'} size="sm" className="flex-1 text-[10px] h-8" onClick={() => setSelectedFormat('xlsx')}>EXCEL</Button>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider">{t('report_language_label')}</h4>
                <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''} p-1 rounded-xl bg-white/10 dark:bg-black/20 border border-white/20 dark:border-white/5 backdrop-blur-md shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all duration-300`}>
                  <Button 
                    type="button"
                    variant={selectedLanguage === 'en' ? 'default' : 'ghost'} 
                    size="sm" 
                    className={`flex-1 text-[10px] h-7 rounded-lg transition-all duration-300 ${selectedLanguage === 'en' ? 'bg-primary text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'text-muted-foreground hover:bg-white/5'}`} 
                    onClick={() => setSelectedLanguage('en')}
                  >
                    English
                  </Button>
                  <Button 
                    type="button"
                    variant={selectedLanguage === 'fr' ? 'default' : 'ghost'} 
                    size="sm" 
                    className={`flex-1 text-[10px] h-7 rounded-lg transition-all duration-300 ${selectedLanguage === 'fr' ? 'bg-primary text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'text-muted-foreground hover:bg-white/5'}`} 
                    onClick={() => setSelectedLanguage('fr')}
                  >
                    Français
                  </Button>
                  <Button 
                    type="button"
                    variant={selectedLanguage === 'ar' ? 'default' : 'ghost'} 
                    size="sm" 
                    className={`flex-1 text-[10px] h-7 rounded-lg transition-all duration-300 ${selectedLanguage === 'ar' ? 'bg-primary text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'text-muted-foreground hover:bg-white/5'}`} 
                    onClick={() => setSelectedLanguage('ar')}
                  >
                    العربية
                  </Button>
                </div>
              </div>

              {generating ? (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-[10px] mb-1 font-bold text-primary">
                    <span className="animate-pulse flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t('compiling_report')}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="bg-primary h-1.5 rounded-full animate-progress-mock" style={{ width: '75%', transition: 'width 2s ease-in-out' } as React.CSSProperties}></div>
                  </div>
                </div>
              ) : (
                <Button className="w-full mt-2 h-10 font-bold bg-primary hover:bg-primary/90 text-white transition-all duration-300 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] active:scale-95" onClick={handleGenerateCustom} disabled={!isValidRange}>
                  <Download className="w-4 h-4 mr-2" />
                  {t('reports_generate_custom')}
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground text-center italic mt-2">{t('gen_rep_disclaimer')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Reports;
