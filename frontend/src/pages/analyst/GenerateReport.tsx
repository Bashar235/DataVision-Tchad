import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, Download, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { generateReport } from "@/services/api";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NamingModal from "@/components/modals/NamingModal";
import { downloadFile } from "@/utils/fileUtils";

const GenerateReport = () => {
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedCharts, setSelectedCharts] = useState<string[]>([
    "population",
    "employment",
  ]);
  const [isNamingOpen, setIsNamingOpen] = useState(false);

  const charts = [
    { id: "population", label: t('population_growth') },
    { id: "employment", label: t('employment_rate') },
    { id: "age", label: t('age_distribution') },
    { id: "gdp", label: t('gdp_growth') },
    { id: "predictive", label: t('side_nav_predictive_analytics') },
  ];

  const templates = [
    { id: "standard", label: t('generate_report_standard'), charts: ["population", "employment", "age", "gdp"] },
    { id: "monthly_demo", label: t('generate_report_monthly'), charts: ["population", "age"] },
    { id: "quarterly_gdp", label: t('generate_report_quarterly'), charts: ["gdp", "employment"] },
    { id: "custom", label: t('generate_report_custom'), charts: [] },
  ];

  useEffect(() => {
    // Default to Standard Report
    setSelectedTemplate("standard");
    const std = templates.find(t => t.id === "standard");
    if (std) setSelectedCharts(std.charts);
  }, []);

  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value);
    const template = templates.find(t => t.id === value);
    if (template && value !== "custom") {
      setSelectedCharts(template.charts);
    }
  };

  const handleGenerateClick = () => {
    if (!selectedTemplate) {
      toast({ variant: "destructive", title: t('common_error'), description: t('generate_report_select_template') });
      return;
    }
    setIsNamingOpen(true);
  };

  const onNamingConfirm = async (customFilename: string) => {
    setGenerating(true);
    setProgress(10);

    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? prev : prev + 10));
    }, 500);

    try {
      let templateName = t('generate_report_custom');
      if (selectedTemplate === 'standard') templateName = t('generate_report_standard');
      else if (selectedTemplate === 'quarterly_gdp') templateName = t('generate_report_quarterly');
      else if (selectedTemplate === 'monthly_demo') templateName = t('generate_report_monthly');

      const blob = await generateReport(templateName, selectedCharts, customFilename);

      clearInterval(interval);
      setProgress(100);

      const finalFilename = customFilename.toLowerCase().endsWith(".pdf") ? customFilename : `${customFilename}.pdf`;
      downloadFile(blob, finalFilename);

      toast({
        title: t('automated_report'),
        description: t('generate_report_success'),
      });
    } catch (error) {
      clearInterval(interval);
      console.error("Report generation failed", error);
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('generate_report_failed'),
      });
    } finally {
      setTimeout(() => {
        setGenerating(false);
        setProgress(0);
      }, 1000);
    }
  };

  const mainPadding = isRtl ? 'pr-[80px]' : 'pl-[80px]';

  return (
    <div className="min-h-screen bg-background">
      <AnalystSidebar />

      <main className={`${mainPadding} p-6 overflow-auto transition-all duration-300`}>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-start">
            <h1 className="text-3xl font-bold text-foreground">{t('side_nav_generate_report')}</h1>
            <p className="text-muted-foreground">{t('automated_report_desc')}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="text-start">
                <CardTitle>{t('automated_report')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-start">
                <p className="text-sm text-muted-foreground">
                  {t('included_content')} {t('reports_demographic_overview')}, {t('reports_socio_economic')}, {t('charts_visualizations')}, {t('forecast_2024_2030')}
                </p>

                {generating && <Progress value={progress} className="w-full" />}

                <Button className="w-full" onClick={handleGenerateClick} disabled={generating}>
                  {generating ? <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} /> : <FileText className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />}
                  {t('generate_pdf')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-start">
                <CardTitle>{t('generate_report_custom_builder')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-start">
                <div className="space-y-3">
                  <Label className="text-base">{t('generate_report_saved_templates')}</Label>
                  <Select onValueChange={handleTemplateChange} disabled={generating} value={selectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('generate_report_select_template')} />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Label className="text-base">{t('custom_report_desc')}</Label>
                  {charts.map((chart) => (
                    <div key={chart.id} className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                      <Checkbox
                        id={chart.id}
                        checked={selectedCharts.includes(chart.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCharts([...selectedCharts, chart.id]);
                          } else {
                            setSelectedCharts(
                              selectedCharts.filter((id) => id !== chart.id)
                            );
                          }
                        }}
                      />
                      <Label htmlFor={chart.id} className="cursor-pointer">
                        {chart.label}
                      </Label>
                    </div>
                  ))}
                </div>

                {generating && <Progress value={progress} className="w-full" />}

                <Button className="w-full" variant="outline" onClick={handleGenerateClick} disabled={generating}>
                  {generating ? <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} /> : <Download className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />}
                  {t('create_report')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <NamingModal
        isOpen={isNamingOpen}
        onClose={() => setIsNamingOpen(false)}
        onConfirm={onNamingConfirm}
        defaultFilename={`${selectedTemplate}_report_${new Date().toISOString().split('T')[0]}`}
      />
    </div>
  );
};

export default GenerateReport;
