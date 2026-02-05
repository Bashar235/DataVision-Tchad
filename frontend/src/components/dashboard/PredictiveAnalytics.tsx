import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Brain, Loader2, TrendingUp } from "lucide-react";
import { predictGrowth } from "@/services/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const PredictiveAnalytics = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [birthRate, setBirthRate] = useState([4.5]);
  const [migrationRate, setMigrationRate] = useState([0.5]);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handlePredict = async () => {
    setLoading(true);
    try {
      const years = [2020, 2021, 2022, 2023, 2024, 2025, 2030, 2035, 2040];
      const newData: any[] = [];

      // Get historical data from first prediction
      const firstPred = await predictGrowth(2023, birthRate[0] * 10, 12, migrationRate[0] * 10);
      if (firstPred.historical_trend && firstPred.historical_trend.length > 0) {
        firstPred.historical_trend.forEach((h: any) => {
          newData.push({
            year: h.year.toString(),
            actual: (h.population / 1000000).toFixed(2),
            predicted: null
          });
        });
      }

      // Add predictions
      for (const year of years.slice(4)) { // From 2024 onwards
        const pred = await predictGrowth(year, birthRate[0] * 10, 12, migrationRate[0] * 10);
        newData.push({
          year: year.toString(),
          actual: null,
          predicted: (pred.predicted_population / 1000000).toFixed(2)
        });
      }

      setForecastData(newData);
    } catch (error) {
      console.error("Prediction failed", error);
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('reports_generation_failed'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handlePredict();
    }, 500);
    return () => clearTimeout(timer);
  }, [birthRate, migrationRate]);

  const pop2030 = forecastData.find(d => d.year === "2030")?.predicted || "N/A";
  const pop2040 = forecastData.find(d => d.year === "2040")?.predicted || "N/A";
  const pop2023 = forecastData.find(d => d.year === "2023")?.actual || "N/A";
  const growthRate = pop2023 !== "N/A" && pop2040 !== "N/A" ?
    (((parseFloat(pop2040) / parseFloat(pop2023)) ** (1 / 17) - 1) * 100).toFixed(1) : "N/A";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="text-start">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            {t('predictive_analytics')}
          </CardTitle>
          <CardDescription>
            {t('adjust_variables')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-primary/20">
              <CardHeader className="text-start">
                <CardTitle className="text-base">{t('scenario_modeling_tool')}</CardTitle>
                <CardDescription>{t('adjust_variables')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-start">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t('birth_rate')}</Label>
                    <span className="text-sm font-medium">{birthRate[0].toFixed(1)}%</span>
                  </div>
                  <Slider
                    value={birthRate}
                    onValueChange={setBirthRate}
                    min={2}
                    max={7}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t('migration_rate')}</Label>
                    <span className="text-sm font-medium">{migrationRate[0].toFixed(1)}%</span>
                  </div>
                  <Slider
                    value={migrationRate}
                    onValueChange={setMigrationRate}
                    min={-2}
                    max={3}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => handlePredict()} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                    {t('run_forecast')}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setBirthRate([4.5]);
                    setMigrationRate([0.5]);
                  }}>{t('common_reset')}</Button>
                </div>
              </CardContent>
            </Card>

            <div className="md:col-span-2">
              <Card>
                <CardHeader className="text-start">
                  <CardTitle className="text-base flex items-center gap-2">
                    {t('population_forecast')}
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={forecastData} key={forecastData.length}>
                        <defs>
                          <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="year" className="text-xs" reversed={isRtl} />
                        <YAxis className="text-xs" orientation={isRtl ? 'right' : 'left'} />
                        <Tooltip contentStyle={{ textAlign: isRtl ? 'right' : 'left' }} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="actual"
                          stroke="hsl(var(--primary))"
                          fill="url(#actualGradient)"
                          strokeWidth={2}
                          name={t('real_data')}
                        />
                        <Area
                          type="monotone"
                          dataKey="predicted"
                          stroke="hsl(var(--chart-2))"
                          fill="url(#predictedGradient)"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          name={t('ai_forecast')}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3 text-start">
                <CardTitle className="text-sm font-medium">{t('pop_2030')}</CardTitle>
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">{pop2030}M</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pop2023 !== "N/A" && pop2030 !== "N/A" ? `+${(((parseFloat(pop2030) / parseFloat(pop2023)) - 1) * 100).toFixed(0)}% ${t('vs_2023')}` : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 text-start">
                <CardTitle className="text-sm font-medium">{t('pop_2040')}</CardTitle>
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">{pop2040}M</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pop2023 !== "N/A" && pop2040 !== "N/A" ? `+${(((parseFloat(pop2040) / parseFloat(pop2023)) - 1) * 100).toFixed(0)}% ${t('vs_2023')}` : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 text-start">
                <CardTitle className="text-sm font-medium">{t('annual_average')}</CardTitle>
              </CardHeader>
              <CardContent className="text-start">
                <div className="text-2xl font-bold">{growthRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">{t('analytics_ml_model_active')}</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PredictiveAnalytics;
