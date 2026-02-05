import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Calendar, Eye, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { generateReport, getReportHistory, downloadReport } from "@/services/api";

const Reports = () => {
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();
  const [reports, setReports] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedVisualizations, setSelectedVisualizations] = useState<string[]>([]);
  const [selectedFormat, setSelectedFormat] = useState("pdf");

  // Sections config
  const dataSections = [
    { id: 'demographic', label: t('demographic') },
    { id: 'economic', label: t('economic') },
    { id: 'employment_rate', label: t('employment_rate') },
    { id: 'regional_distribution', label: t('regional_distribution') },
    { id: 'predictive_analytics', label: t('predictive_analytics') }
  ];

  const vizOptions = [
    { id: 'charts', label: t('side_nav_visualizations') },
    { id: 'maps', label: t('regional_distribution') },
    { id: 'tables', label: t('database_table') },
    { id: 'trends', label: t('analytics_growth_trajectories') },
    { id: 'overview', label: t('side_nav_overview') }
  ];

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await getReportHistory();
      if (data && Array.isArray(data) && data.length > 0) {
        // Map report_type to title for consistency if needed
        const mappedData = data.map((r: any) => ({
          ...r,
          title: r.report_type || r.filename || "Untitled Report",
          date: r.timestamp ? new Date(r.timestamp).toLocaleDateString() : "Unknown Date"
        }));
        setReports(mappedData);
      } else {
        setReports([
          { id: 1, title: "Q4 2023 Demographic Overview", description: "Comprehensive analysis of population trends", date: "Dec 15, 2023", pages: 24, status: "completed", downloads: 45, filename: "report1.pdf" },
          { id: 2, title: "Annual Employment Report 2023", description: "Labor force statistics", date: "Nov 28, 2023", pages: 18, status: "completed", downloads: 32, filename: "report2.pdf" },
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

    toast({
      title: t('reports_download_started'),
      description: `${t('reports_downloading')} "${reportTitle}"`
    });

    try {
      const blob = await downloadReport(filename);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: t('error'), description: t('error_download_failed'), variant: "destructive" });
    }
  };

  const handlePreview = async (filename: string, reportTitle: string) => {
    toast({
      title: t('reports_opening_preview'),
      description: `${t('reports_loading')} "${reportTitle}"`
    });

    try {
      const blob = await downloadReport(filename);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Note: URL.revokeObjectURL(url) should ideally be called when the tab is closed, 
      // but for a simple preview it's okay to let it be or revoke after a delay.
    } catch (e) {
      toast({ title: t('error'), description: t('error_preview_failed'), variant: "destructive" });
    }
  };

  const toggleSection = (id: string) => {
    setSelectedSections(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleViz = (id: string) => {
    setSelectedVisualizations(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGenerateCustom = async () => {
    if (selectedSections.length === 0 && selectedVisualizations.length === 0) {
      toast({ title: t('error'), description: t('error_select_section'), variant: "destructive" });
      return;
    }

    setGenerating(true);
    toast({ title: t('generating_report'), description: t('please_wait') });

    try {
      const payload = [...selectedSections, ...selectedVisualizations];
      const blob = await generateReport("Custom", payload);

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `DataVision_Tchad_Custom_${dateStr}.${selectedFormat}`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({ title: t('success'), description: t('success_report_generated') });
      fetchHistory(); // Refresh list
    } catch (e) {
      toast({ title: t('error'), description: t('error_generate_report'), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
        <div className="text-start">
          <h1 className="text-3xl font-bold mb-2">{t('reports_library_title')}</h1>
          <p className="text-muted-foreground">{t('reports_library_subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button className={`gap-2 ${isRtl ? 'flex-row-reverse' : ''}`} onClick={handleGenerateCustom} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {t('reports_generate_new')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 text-start">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports_total_reports')}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">{reports.length}</div>
            <p className="text-xs text-muted-foreground mt-1">+18 {t('reports_this_month')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 text-start">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports_total_downloads')}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">1,847</div>
            <p className="text-xs text-muted-foreground mt-1">+245 {t('reports_this_month')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 text-start">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports_avg_pages')}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-2xl font-bold">22</div>
            <p className="text-xs text-muted-foreground mt-1">{t('reports_per_report')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 text-start">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports_most_popular')}</CardTitle>
          </CardHeader>
          <CardContent className="text-start">
            <div className="text-sm font-bold">{t('population_forecast')}</div>
            <p className="text-xs text-muted-foreground mt-1">58 {t('reports_downloads')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {reports.map((report) => (
          <Card key={report.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className={`flex items-start justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="flex-1">
                  <div className={`flex items-center gap-3 mb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-start">
                      <h3 className="font-semibold text-lg">{report.title}</h3>
                      <p className="text-sm text-muted-foreground">{report.description || report.filename}</p>
                    </div>
                  </div>

                  <div className={`flex items-center gap-4 mt-4 text-sm text-muted-foreground ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Calendar className="h-4 w-4" />
                      {report.date || new Date().toLocaleDateString()}
                    </div>
                    <div>{report.pages || 10} {t('reports_pages')}</div>
                    <div>{report.downloads || 0} {t('reports_downloads')}</div>
                    <Badge variant="outline" className={isRtl ? 'mr-auto' : 'ml-auto'}>{report.status || "ready"}</Badge>
                  </div>
                </div>

                <div className={`flex gap-2 ${isRtl ? 'mr-4' : 'ml-4'} ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <Button variant="outline" size="sm" onClick={() => handlePreview(report.filename, report.title)} className={isRtl ? 'flex-row-reverse' : ''}>
                    <Eye className={`h-4 w-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                    {t('reports_preview')}
                  </Button>
                  <Button variant="default" size="sm" onClick={() => handleDownload(report.filename, report.title)} className={isRtl ? 'flex-row-reverse' : ''}>
                    <Download className={`h-4 w-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                    {t('reports_download')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-2 border-dashed">
        <CardHeader className="text-start">
          <CardTitle>{t('reports_custom_builder_title')}</CardTitle>
          <CardDescription>{t('reports_custom_builder_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-start">{t('reports_select_data_sections')}:</h4>
              <div className="space-y-2">
                {dataSections.map((section) => (
                  <div key={section.id} className={`flex items-center gap-2 text-sm ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedSections.includes(section.id)}
                      onChange={() => toggleSection(section.id)}
                    />
                    <label className="text-start">{section.label}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm text-start">{t('reports_visualization_options')}:</h4>
              <div className="space-y-2">
                {vizOptions.map((option) => (
                  <div key={option.id} className={`flex items-center gap-2 text-sm ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedVisualizations.includes(option.id)}
                      onChange={() => toggleViz(option.id)}
                    />
                    <label className="text-start">{option.label}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 md:col-span-2 pt-2 border-t">
              <h4 className="font-medium text-sm text-start">Report Format:</h4>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="pdf" checked={selectedFormat === "pdf"} onChange={() => setSelectedFormat("pdf")} />
                  <span className="text-sm">PDF (Professional Document)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="xlsx" checked={selectedFormat === "xlsx"} onChange={() => setSelectedFormat("xlsx")} />
                  <span className="text-sm">Excel (Data Analysis)</span>
                </label>
              </div>
            </div>
          </div>

          <div className={`flex gap-2 mt-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Button className={`flex-1 ${isRtl ? 'flex-row-reverse' : ''}`} onClick={handleGenerateCustom} disabled={generating}>
              {generating ? <Loader2 className={`h-4 w-4 animate-spin ${isRtl ? 'ml-2' : 'mr-2'}`} /> : <FileText className={`h-4 w-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />}
              {t('reports_generate_custom')}
            </Button>
            <Button variant="outline">{t('reports_save_template')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
