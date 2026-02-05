import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar, Cell, PieChart, Pie } from "recharts";
import { Brain, TrendingUp, AlertCircle, CheckCircle2, Filter, Loader2 } from "lucide-react";
import BirthDeathChart from "@/components/dashboard/charts/BirthDeathChart";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { calculatePrediction } from "@/services/api";

const Analytics = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [val1, setVal1] = useState([35]);
  const [val2, setVal2] = useState([8]);
  const [val3, setVal3] = useState([2]);
  const [selectedModel, setSelectedModel] = useState("population");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedYear, setSelectedYear] = useState("2030");
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [growthPercent, setGrowthPercent] = useState(0);
  const [confidence, setConfidence] = useState(94.7);

  // Dynamic Modelling Fetch
  const handleRunAnalysis = async () => {
    setLoading(true);
    setComparisonData([]); // Clear for re-animation
    try {
      // Trigger backend call
      const data = await calculatePrediction(selectedRegion, parseInt(selectedYear), selectedModel);

      if (data.trained) {
        toast({
          title: t('model_training_title'),
          description: t('model_training_desc').replace('{region}', selectedRegion),
        });
      }

      // Transform and Set
      const pred = data.prediction.map((p: any) => ({
        year: p.year,
        baseline: p.value * 0.95, // mock baseline
        simulated: p.value
      }));

      setComparisonData(pred);
      setGrowthPercent(data.forecasted_growth);
      setConfidence(data.confidence_score * 100);

    } catch (e) {
      toast({
        title: t('analysis_failed_title'),
        description: t('analysis_failed_desc'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRunAnalysis();
  }, [selectedModel, selectedRegion, selectedYear]);

  // Simulation Logic (Local adjustments on simple factor)
  useEffect(() => {
    if (comparisonData.length === 0) return;

    let factor = (val1[0] / 35) * (1 - (val2[0] - 8) / 100) * (1 + (val3[0] - 2) / 100);
    if (selectedModel === "gdp") factor = (val1[0] / 15) * (1 + (val2[0] - 5) / 50) * (1 - (val3[0] - 10) / 100);
    if (selectedModel === "employment") factor = (val1[0] / 60) * (1 + (val2[0] - 5) / 20) * (1 + (val3[0] - 10) / 50);

    const adjusted = comparisonData.map(d => ({
      ...d,
      simulated: Number((d.baseline * factor * 1.05).toFixed(2))
    }));
    setComparisonData(adjusted);
  }, [val1, val2, val3]);

  const modelMetrics = [
    { label: t('analytics_accuracy'), value: `${confidence.toFixed(1)}%`, status: "success" },
    { label: t('analytics_r2_score'), value: "0.92", status: "success" },
    { label: t('analytics_mae'), value: selectedModel === "population" ? "0.28M" : "0.15%", status: "success" },
    { label: t('analytics_last_updated'), value: `2${t('overview_hours_ago')}`, status: "info" },
    { label: t('migration_impact'), value: "High", status: "warning" },
    { label: t(' आर्थिक_correlation') || "Correlation", value: "0.85", status: "success" }
  ];

  const sliderConfigs: any = {
    population: [
      { id: "birth", label: t('birth_rate'), val: val1, set: setVal1, min: 20, max: 50, step: 1, desc: t('analytics_current_births') },
      { id: "mortality", label: t('mortality_rate'), val: val2, set: setVal2, min: 5, max: 15, step: 0.5, desc: t('analytics_current_deaths') },
      { id: "migration", label: t('migration_rate'), val: val3, set: setVal3, min: -5, max: 10, step: 0.5, desc: t('analytics_current_migration') },
    ],
    gdp: [
      { id: "investment", label: t('investment_rate') || "Investment Rate", val: val1, set: setVal1, min: 5, max: 30, step: 1, desc: t('investment_desc') },
      { id: "trade", label: t('trade_balance') || "Trade Balance", val: val2, set: setVal2, min: -10, max: 20, step: 1, desc: t('trade_desc') },
      { id: "fiscal", label: t('fiscal_policy') || "Fiscal Policy", val: val3, set: setVal3, min: 0, max: 20, step: 1, desc: t('fiscal_desc') },
    ],
    employment: [
      { id: "labor", label: t('labor_participation') || "Labor Participation", val: val1, set: setVal1, min: 40, max: 80, step: 1, desc: t('labor_desc') },
      { id: "education", label: t('education_spend') || "Education Spend", val: val2, set: setVal2, min: 2, max: 15, step: 0.5, desc: t('education_desc') },
      { id: "automation", label: t('automation_index') || "Automation Index", val: val3, set: setVal3, min: 0, max: 20, step: 1, desc: t('automation_desc') },
    ]
  };

  const currentSliders = sliderConfigs[selectedModel] || sliderConfigs.population;
  const unit = selectedModel === "population" ? "M" : "%";

  const gaugeData = (val: number, color: string) => [
    { name: 'Value', value: val, fill: color },
    { name: 'Background', value: 100 - val, fill: 'hsl(var(--muted))' }
  ];

  return (
    <div className="space-y-6 relative">
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
        <div className="text-start">
          <h1 className="text-3xl font-bold mb-2">{t('side_nav_predictive_analytics')}</h1>
          <p className="text-muted-foreground">{t('hero_real_time')}</p>
        </div>
        <Badge variant="outline" className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Brain className="h-4 w-4" />
          {t('analytics_ml_model_active')}
        </Badge>
      </div>

      <Card className="bg-white/70 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:bg-white/80">
        <CardHeader className="pb-3 text-start">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> {t('analysis_config_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase block text-start">{t('target_region')}</label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="text-start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('national')}</SelectItem>
                  <SelectItem value="N'Djamena">{t('region_ndjamena')}</SelectItem>
                  <SelectItem value="Logone Occidental">{t('region_logone_occidental')}</SelectItem>
                  <SelectItem value="Mayo-Kebbi Est">{t('region_mayo_kebbi_est')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase block text-start">{t('target_year')}</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="text-start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2030">2030</SelectItem>
                  <SelectItem value="2035">2035</SelectItem>
                  <SelectItem value="2040">2040</SelectItem>
                  <SelectItem value="2050">2050</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase block text-start">{t('analytics_model_type')}</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="text-start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="population">{t('total_population')}</SelectItem>
                  <SelectItem value="gdp">{t('gdp_growth')}</SelectItem>
                  <SelectItem value="employment">{t('employment_rate')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={handleRunAnalysis} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                {t('calculate_forecast')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/70 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:bg-white/80">
        <CardHeader className="text-start">
          <CardTitle>{t('scenario_modeling_tool')}</CardTitle>
          <CardDescription>{t('adjust_variables')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-start">
          <div className="grid gap-6 md:grid-cols-3">
            {currentSliders.map((s: any) => (
              <div key={s.id} className="space-y-3">
                <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <label className="text-sm font-medium">{s.label}</label>
                  <span className="text-sm font-bold text-primary">{s.val[0]}</span>
                </div>
                <Slider value={s.val} onValueChange={s.set} min={s.min} max={s.max} step={s.step} className="w-full" />
                <p className="text-xs text-muted-foreground text-start">{s.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/70 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:bg-white/80 relative">
        {loading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        )}
        <CardHeader className={`bg-primary/5 text-start`}>
          <CardTitle className="text-xl">
            {selectedModel === "population" ? t('population_forecast') : selectedModel === "gdp" ? t('gdp_growth') : t('employment_rate')}
            - {t('analytics_scenario_comparison')}
          </CardTitle>
          <CardDescription>{t('analytics_baseline_vs_simulated')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={450}>
            <LineChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} reversed={isRtl} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
                orientation={isRtl ? 'right' : 'left'}
                label={{ value: selectedModel === "population" ? t('total_population') + " (M)" : unit, angle: -90, position: 'insideLeft', offset: isRtl ? -10 : 10 }}
              />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", textAlign: isRtl ? 'right' : 'left' }} />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="baseline" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" name={t('analytics_baseline')} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="simulated" stroke="hsl(var(--primary))" strokeWidth={4} name={t('analytics_simulated')} dot={{ r: 6, fill: "hsl(var(--primary))" }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BirthDeathChart />

        <Card className="flex flex-col bg-white/70 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:bg-white/80">
          <CardHeader className="text-start pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('forecasted_growth')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center relative min-h-[180px]">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    { name: t('growth_label'), value: growthPercent },
                    { name: t('remaining_label'), value: Math.max(0, 100 - growthPercent) }
                  ]}
                  cx="50%"
                  cy="90%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="#4f46e5" />
                  <Cell fill="hsl(var(--muted)/0.3)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-6">
              <span className="text-4xl font-extrabold text-indigo-950 dark:text-indigo-50">+{growthPercent.toFixed(1)}%</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1">{t('projection_by')} {selectedYear}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col bg-white/70 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:bg-white/80">
          <CardHeader className="text-start pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('confidence_level')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center relative min-h-[180px]">
            <ResponsiveContainer width="100%" height={180}>
              <RadialBarChart
                cx="50%"
                cy="90%"
                innerRadius="80%"
                outerRadius="120%"
                barSize={12}
                data={[{ name: t('confidence_label'), value: confidence, fill: '#10b981' }]}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar
                  background={{ fill: 'hsl(var(--muted)/0.3)' }}
                  dataKey="value"
                  cornerRadius={10}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-6">
              <span className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">{confidence.toFixed(1)}%</span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1">{t('model_reliability')}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
