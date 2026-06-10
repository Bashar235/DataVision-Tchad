import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar, Cell, PieChart, Pie } from "recharts";
import { Brain, TrendingUp, AlertCircle, CheckCircle2, Filter, Loader2 } from "lucide-react";
import BirthDeathChart from "@/components/dashboard/charts/BirthDeathChart";
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

  const handleRunAnalysis = async () => {
    setLoading(true);
    setComparisonData([]);
    try {
      const data = await calculatePrediction(selectedRegion, parseInt(selectedYear), selectedModel);
      if (data.trained) {
        toast({
          title: t('model_training_title'),
          description: t('model_training_desc').replace('{region}', selectedRegion),
        });
      }
      const pred = data.prediction.map((p: any) => ({
        year: p.year,
        baseline: p.value * 0.95,
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
    { label: t('analytics_accuracy'), value: `${confidence.toFixed(1)}%` },
    { label: t('analytics_r2_score'), value: "0.92" },
    { label: t('analytics_mae'), value: selectedModel === "population" ? `0.28 ${t('unit_millions')}` : "0.15%" },
    { label: t('analytics_last_updated'), value: `2 ${t('overview_hours_ago')}` },
    { label: t('migration_impact'), value: t('high_label') },
    { label: t('economic_correlation'), value: "0.85" }
  ];

  const sliderConfigs: any = {
    population: [
      { id: "birth", label: t('birth_rate'), val: val1, set: setVal1, min: 20, max: 50, step: 1, desc: t('analytics_current_births') },
      { id: "mortality", label: t('mortality_rate'), val: val2, set: setVal2, min: 5, max: 15, step: 0.5, desc: t('analytics_current_deaths') },
      { id: "migration", label: t('migration_rate'), val: val3, set: setVal3, min: -5, max: 10, step: 0.5, desc: t('analytics_current_migration') },
    ],
    gdp: [
      { id: "investment", label: t('investment_rate'), val: val1, set: setVal1, min: 5, max: 30, step: 1, desc: t('investment_desc') },
      { id: "trade", label: t('trade_balance'), val: val2, set: setVal2, min: 0.5, max: 2, step: 0.1, desc: t('trade_desc') },
      { id: "fiscal", label: t('fiscal_policy'), val: val3, set: setVal3, min: 0, max: 10, step: 0.5, desc: t('fiscal_desc') },
    ],
    employment: [
      { id: "participation", label: t('labor_participation'), val: val1, set: setVal1, min: 40, max: 80, step: 1, desc: t('labor_desc') },
      { id: "education", label: t('education_spend'), val: val2, set: setVal2, min: 1, max: 10, step: 0.5, desc: t('education_desc') },
      { id: "automation", label: t('automation_index'), val: val3, set: setVal3, min: 0, max: 100, step: 5, desc: t('automation_desc') },
    ]
  };

  const currentSliders = sliderConfigs[selectedModel] || sliderConfigs.population;

  return (
    <div className="max-w-7xl mx-auto space-y-6 mt-4 px-2">
      <div className={`p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
        <div className="text-start">
          <h1 className="text-2xl font-bold text-foreground">{t('predictive_analytics')}</h1>
          <p className="text-muted-foreground text-sm">{t('national_overview')} · {selectedRegion === 'all' ? t('all_regions') : t(`region_TD_${selectedRegion === "N'Djamena" ? 'ND' : selectedRegion === 'Logone Occidental' ? 'LO' : 'ME'}`)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider">{t('analytics_ml_model_active')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
        <div className="space-y-6">
          <Card className="border-border/60 shadow-sm overflow-hidden text-start">
            <CardHeader className="p-4 bg-muted/30 border-b border-border/40">
              <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-wider">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                {t('analysis_config_title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground uppercase tracking-tight block">{t('target_region')}</label>
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger className="h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_regions')}</SelectItem>
                      <SelectItem value="N'Djamena">{t('region_TD_ND')}</SelectItem>
                      <SelectItem value="Logone Occidental">{t('region_TD_LO')}</SelectItem>
                      <SelectItem value="Mayo-Kebbi Est">{t('region_TD_ME')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground uppercase tracking-tight block">{t('target_year')}</label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2030">2030</SelectItem>
                      <SelectItem value="2035">2035</SelectItem>
                      <SelectItem value="2040">2040</SelectItem>
                      <SelectItem value="2050">2050</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground uppercase tracking-tight block">{t('model_label')}</label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="h-9 text-xs bg-background border-primary/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="population">{t('total_population')}</SelectItem>
                    <SelectItem value="gdp">{t('gdp_growth')}</SelectItem>
                    <SelectItem value="employment">{t('employment_rate')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full h-9 text-xs" onClick={handleRunAnalysis} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin ms-2" /> : <Brain className="h-4 w-4 ms-2" />}
                {t('calculate_forecast')}
              </Button>
            </CardContent>
          </Card>

          <div className={`grid grid-cols-2 gap-3 pb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            {modelMetrics.map((m) => (
              <div key={m.label} className="p-3 bg-muted/40 rounded-xl border border-border/40 text-start space-y-1">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{m.label}</p>
                <p className="text-sm font-bold text-foreground">{m.value}</p>
              </div>
            ))}
          </div>

          <Card className="border-border/60 shadow-sm text-start">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-sm font-bold">{t('scenario_modeling_tool')}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
              {currentSliders.map((s: any) => (
                <div key={s.id} className="space-y-3">
                  <div className={`flex items-center justify-between font-bold text-[10px] ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span className="text-foreground uppercase">{s.label}</span>
                    <span className="text-primary bg-primary/10 px-2 py-0.5 rounded">{s.val[0]}</span>
                  </div>
                  <Slider value={s.val} onValueChange={s.set} min={s.min} max={s.max} step={s.step} />
                  <p className="text-[9px] text-muted-foreground italic leading-tight">{s.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/60 shadow-sm relative text-start">
            {loading && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            )}
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-sm font-bold">{t('analytics_scenario_comparison')}</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold text-primary/70">{t('analytics_baseline_vs_simulated')}</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] p-4 pt-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="year" fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} reversed={isRtl} />
                  <YAxis fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={v => `${v}${selectedModel === 'population' ? t('unit_millions') : '%'}`} orientation={isRtl ? "right" : "left"} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', textAlign: isRtl ? 'right' : 'left' }} />
                  <Legend verticalAlign="top" align={isRtl ? "left" : "right"} height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="baseline" name={t('analytics_baseline')} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="simulated" name={t('analytics_simulated')} stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
             <BirthDeathChart />
             <div className="space-y-6">
                <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-4">
                  <div className="p-3 bg-white rounded-xl shadow-sm"><TrendingUp className="w-6 h-6 text-primary" /></div>
                  <div className="text-start">
                    <p className="text-xs font-bold text-primary uppercase tracking-wide">{t('growth_label')} {selectedYear}</p>
                    <p className="text-2xl font-black text-foreground">+{growthPercent.toFixed(1)}%</p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{t('ml_explanation_growth')}</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                  <div className="text-start">
                    <p className="text-[10px] font-bold text-orange-700 uppercase">{t('researcher_methodological_note')}</p>
                    <p className="text-[9px] text-orange-600 mt-0.5">{t('researcher_disclaimer_ai')}</p>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
