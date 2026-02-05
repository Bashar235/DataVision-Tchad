import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import PopulationChart from "@/components/dashboard/charts/PopulationChart";
import EmploymentChart from "@/components/dashboard/charts/EmploymentChart";
import AgeDistributionChart from "@/components/dashboard/charts/AgeDistributionChart";
import GDPChart from "@/components/dashboard/charts/GDPChart";
import PredictiveChart from "@/components/dashboard/charts/PredictiveChart";
import DataQualityChart from "@/components/dashboard/charts/DataQualityChart";
import { useLanguage } from "@/contexts/LanguageContext";
import { predictGrowth, getAdminStats, adminExport } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, FileText, TrendingUp, Users, Briefcase, DollarSign, Database } from "lucide-react";
import LanguageSwitcher from "@/components/dashboard/LanguageSwitcher";

const AnalystDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const fetchStats = async () => {
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats", error);
    }
  };

  useEffect(() => {
    fetchStats();

    // Check for forbidden access redirect
    if (window.history.state?.usr?.forbidden) {
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('analyst_forbidden_desc'),
      });
    }
  }, [t, toast]);

  useEffect(() => {
    const fetchForecast = async () => {
      setLoading(true);
      try {
        // Fetch a default forecast for 2025
        const res = await predictGrowth(2025);
        if (res.historical_trend) {
          const formatted = [
            ...res.historical_trend.map((h: any) => ({
              year: h.year.toString(),
              actual: Number((h.population / 1000000).toFixed(2)),
              forecast: null
            })),
            {
              year: "2025",
              actual: null,
              forecast: Number((res.predicted_population / 1000000).toFixed(2))
            }
          ];
          setForecastData(formatted);
        }
      } catch (err) {
        console.error("Failed to fetch analyst forecast", err);
      } finally {
        setLoading(false);
      }
    };
    fetchForecast();
  }, []);

  const handleExportData = async () => {
    setExporting(true);
    try {
      await adminExport('csv', 'General Data');
      toast({
        title: t('export_started'),
        description: t('export_traceability'),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('upload_error_desc'),
      });
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateReport = () => {
    toast({
      title: t('automated_report'),
      description: t('generating_pdf'),
    });
  };

  const mainPadding = isRtl ? 'pr-[80px]' : 'pl-[80px]';

  return (
    <div className="min-h-screen bg-background">
      <AnalystSidebar />

      <main className={`${mainPadding} p-6 overflow-auto transition-all duration-300`}>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="text-start">
              <h1 className="text-3xl font-bold text-foreground">{t('dashboard_analyst')}</h1>
              <p className="text-muted-foreground">{t('dashboard_inseed_platform')}</p>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <div className={`flex gap-2 ${isRtl ? 'border-r pr-4' : 'border-l pl-4'}`}>
                <Button variant="outline" onClick={handleExportData} disabled={exporting}>
                  {exporting ? <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} /> : <Download className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />}
                  {t('side_nav_export_data')}
                </Button>
                <Button onClick={handleGenerateReport}>
                  <FileText className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                  {t('side_nav_generate_report')}
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 text-start">
                <CardTitle className="text-sm font-medium">{t('total_population')}</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">
                  {stats ? (stats.current_population_estimate / 1000000).toFixed(1) + 'M' : '...'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats ? stats.avg_growth_rate : '...'} {t('from_last_year')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 text-start">
                <CardTitle className="text-sm font-medium">{t('employment_rate')}</CardTitle>
                <Briefcase className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">58.3%</div>
                <p className="text-xs text-muted-foreground">+1.2% {t('from_last_year')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 text-start">
                <CardTitle className="text-sm font-medium">{t('gdp_growth')}</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">4.2%</div>
                <p className="text-xs text-muted-foreground">+0.5% {t('from_last_year')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 text-start">
                <CardTitle className="text-sm font-medium">{t('gdp_per_capita')}</CardTitle>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">$695</div>
                <p className="text-xs text-muted-foreground">{stats ? stats.database_status : '...'} • {t('from_last_year')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="text-start">
              <TabsTrigger value="overview">{t('side_nav_overview')}</TabsTrigger>
              <TabsTrigger value="predictive">{t('side_nav_predictive_analytics')}</TabsTrigger>
              <TabsTrigger value="data">{t('data_table')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <DataQualityChart />
                </div>
                <div className="lg:col-span-1">
                  <AgeDistributionChart />
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PopulationChart />
                <EmploymentChart />
              </div>
            </TabsContent>

            <TabsContent value="predictive" className="space-y-4">
              <div className={loading ? "opacity-50" : ""}>
                <PredictiveChart data={forecastData.length > 0 ? forecastData : undefined} />
              </div>
            </TabsContent>

            <TabsContent value="data" className="space-y-4">
              <Card>
                <CardContent className="pt-6 text-start">
                  <div className="text-center py-12 text-muted-foreground">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>{t('no_anomalies')}</p>
                    <Button variant="link" onClick={() => navigate("/analyst/database")}>
                      {t('side_nav_database')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default AnalystDashboard;
