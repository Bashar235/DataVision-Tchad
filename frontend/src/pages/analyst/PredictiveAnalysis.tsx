import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import PredictiveChart from "@/components/dashboard/charts/PredictiveChart";
import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Loader2, RefreshCw } from "lucide-react";
import { predictGrowth } from "@/services/api";

import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const PredictiveAnalysis = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [birthRate, setBirthRate] = useState([35]);
  const [mortality, setMortality] = useState([12]);
  const [migration, setMigration] = useState([2]);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);

  const handlePredict = useCallback(async () => {
    setLoading(true);
    try {
      // Use current state values
      const currentBirthRate = birthRate[0];
      const currentMortality = mortality[0];
      const currentMigration = migration[0];

      console.log(`[PredictiveAnalysis] Running simulation with: Birth=${currentBirthRate}, Mort=${currentMortality}, Mig=${currentMigration}`);

      // We'll predict 5 years into the future as an example
      const yearsToPredict = [2025, 2026, 2027, 2028, 2029, 2030];
      const newChartData = [];

      // First, get historical context from first call
      const firstPred = await predictGrowth(yearsToPredict[0], currentBirthRate, currentMortality, currentMigration);

      console.log("First prediction result:", firstPred);

      // Transform historical data for chart
      if (firstPred.historical_trend && firstPred.historical_trend.length > 0) {
        const hist = firstPred.historical_trend.map((h: any) => ({
          year: h.year.toString(),
          actual: Number((h.population / 1000000).toFixed(2)), // Convert to millions (Number)
          forecast: null
        }));
        newChartData.push(...hist);
      }

      // Add first prediction
      newChartData.push({
        year: yearsToPredict[0].toString(),
        actual: null,
        forecast: Number((firstPred.predicted_population / 1000000).toFixed(2)) // Number
      });

      // Add rest
      for (let i = 1; i < yearsToPredict.length; i++) {
        const pred = await predictGrowth(yearsToPredict[i], currentBirthRate, currentMortality, currentMigration);
        // console.log(`Prediction for ${yearsToPredict[i]}:`, pred);
        newChartData.push({
          year: yearsToPredict[i].toString(),
          actual: null,
          forecast: Number((pred.predicted_population / 1000000).toFixed(2)) // Number
        });
      }

      console.log("Final Chart Data:", newChartData);
      setChartData(newChartData);

    } catch (error) {
      console.error("Prediction failed", error);
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('generate_report_failed'),
      });
    } finally {
      setLoading(false);
    }
  }, [birthRate, mortality, migration, t, toast]);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      handlePredict();
    }, 500);

    return () => clearTimeout(timer);
  }, [birthRate, mortality, migration, handlePredict]);

  const mainPadding = isRtl ? 'pr-[80px]' : 'pl-[80px]';

  return (
    <div className="min-h-screen bg-background">
      <AnalystSidebar />

      <main className={`${mainPadding} p-6 overflow-auto transition-all duration-300`}>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-start">
            <h1 className="text-3xl font-bold text-foreground">{t('side_nav_predictive_analytics')}</h1>
            <p className="text-muted-foreground">{t('hero_real_time')}</p>
          </div>

          <Card>
            <CardHeader className="text-start">
              <CardTitle className="flex items-center justify-between">
                <span>{t('scenario_modeling_tool')}</span>
                {loading && <span className="text-sm font-normal text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> {t('updating_analytics')}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className={`flex justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <label className="text-sm font-medium text-foreground">{t('birth_rate')}</label>
                    <span className="text-sm text-muted-foreground">{birthRate[0]}</span>
                  </div>
                  <Slider value={birthRate} onValueChange={setBirthRate} min={20} max={50} step={1} />
                </div>

                <div className="space-y-2">
                  <div className={`flex justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <label className="text-sm font-medium text-foreground">{t('reports_socio_economic')} ({t('mortality_rate')})</label>
                    <span className="text-sm text-muted-foreground">{mortality[0]}</span>
                  </div>
                  <Slider value={mortality} onValueChange={setMortality} min={5} max={20} step={1} />
                </div>

                <div className="space-y-2">
                  <div className={`flex justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <label className="text-sm font-medium text-foreground">{t('migration_rate')}</label>
                    <span className="text-sm text-muted-foreground">{migration[0]}</span>
                  </div>
                  <Slider value={migration} onValueChange={setMigration} min={-5} max={10} step={0.5} />
                </div>
              </div>

              <div className={`flex items-center gap-2 p-3 bg-primary/5 text-primary rounded-lg text-sm ${isRtl ? 'flex-row-reverse' : ''}`}>
                <RefreshCw className="w-4 h-4 animate-spin-slow" />
                <span>{t('hero_real_time')}: {t('updating_analytics')}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-start">
              <CardTitle>{t('population_forecast')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                <PredictiveChart data={chartData.length > 0 ? chartData : undefined} />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PredictiveAnalysis;
