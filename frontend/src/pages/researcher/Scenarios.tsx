import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import PredictiveChart from "@/components/dashboard/charts/PredictiveChart";
import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Camera, Cpu, BarChart2, Brain, MapPin, AlertTriangle } from "lucide-react";
import html2canvas from "html2canvas";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import { DatasetDropdown, DatasetMeta, BaselineData } from "@/components/researcher/DatasetDropdown";
import { DatasetErrorPanel, AuditResult } from "@/components/researcher/DatasetErrorPanel";

// ─── Constants ────────────────────────────────────────────────────────────────
const REGION_MAP: Record<string, string> = {
  "Tchad": "region_tchad",
  "N'Djaména": "region_TD_ND",
  "Batha": "region_TD_BA",
  "Borkou": "region_TD_BO",
  "Chari Baguirmi": "region_TD_CB",
  "Guéra": "region_TD_GU",
  "Hadjer Lamis": "region_TD_HL",
  "Kanem": "region_TD_KA",
  "Lac": "region_TD_LC",
  "Logone Occidental": "region_TD_LO",
  "Logone Oriental": "region_TD_LR",
  "Mandoul": "region_TD_MA",
  "Mayo Kebbi Est": "region_TD_ME",
  "Mayo Kebbi Ouest": "region_TD_MO",
  "Moyen Chari": "region_TD_MC",
  "Ouaddaï": "region_TD_OU",
  "Salamat": "region_TD_SA",
  "Tandjilé": "region_TD_TA",
  "Wadi Fira": "region_TD_WF",
  "Barh El Gazal": "region_TD_BG",
  "Barh El Gazel": "region_TD_BG",
  "Bahr el Gazel": "region_TD_BG",
  "Bahr El Gazel": "region_TD_BG",
  "Ennedi": "region_TD_EE",
  "Ennedi Est": "region_TD_EE",
  "Ennedi-Est": "region_TD_EE",
  "Ennedi Ouest": "region_TD_EO",
  "Ennedi-Ouest": "region_TD_EO",
  "Sila": "region_TD_SI",
  "Tibesti": "region_TD_TI",
};

const FEATURE_LABELS: Record<string, string> = {
  year:      "year",
  ISF:       "researcher_fertility_isf",
  e0:        "researcher_health_e0",
  TMI:       "researcher_mortality_tmi",
  Cc:        "researcher_indicator_contraception",
  Cm:        "researcher_indicator_nuptiality",
};

const FeatureImportancePanel = ({ fi }: { fi: Record<string, number> }) => {
  const { t } = useLanguage();
  const entries = Object.entries(fi).slice(0, 5);
  const maxVal = Math.max(...entries.map(e => e[1]), 1);
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase font-semibold text-muted-foreground text-start">{t('researcher_indicator_influence')}</p>
      {entries.map(([key, pct]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-28 truncate shrink-0 text-start">
            {t(FEATURE_LABELS[key] || key)}
          </span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded-full transition-all duration-500"
              style={{ width: `${(pct / maxVal) * 100}%` } as React.CSSProperties}
            />
          </div>
          <span className="text-[10px] font-mono text-foreground w-9 text-end">{pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
};

const Scenarios = () => {
  const { t, isRtl } = useLanguage();

  // ── Power Sliders (Levers) ──────────────────────────────────────────────────
  const [isf, setIsf] = useState([5.8]);
  const [e0,  setE0]  = useState([60.2]);
  const [tmi, setTmi] = useState([78.0]);
  const [selectedRegion, setSelectedRegion] = useState("Tchad");
  const [selectedProvince, setSelectedProvince] = useState<string>("National");
  const [modelType, setModelType] = useState<"ensemble" | "prophet" | "baseline">("ensemble");

  const [loading,      setLoading]      = useState(false);
  const [chartData,    setChartData]    = useState<any[]>([]);
  const [scenarioMeta, setScenarioMeta] = useState<any>(null);
  const [hasRun,       setHasRun]       = useState(false);
  const [isSynthetic,  setIsSynthetic]  = useState<boolean | null>(null);

  // ── Dataset & Baseline State ───────────────────────────────────────────────
  const [selectedDataset,  setSelectedDataset]  = useState<DatasetMeta | null>(null);
  const [auditResult,      setAuditResult]      = useState<AuditResult | null>(null);
  const [baselineData,     setBaselineData]     = useState<BaselineData | null>(null);

  const { toast } = useToast();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef<HTMLDivElement>(null);

  const handlePredict = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("authToken");
      const years = Array.from({ length: 42 }, (_, i) => 2009 + i);

      // Call project-scenario simulation
      const reqBody: any = {
        model_type: modelType,
        region: selectedRegion,
        province: selectedProvince,
        ISF:    isf[0],
        e0:     e0[0],
        TMI:    tmi[0],
        years,
      };
      if (selectedDataset) {
        reqBody.dataset_id = selectedDataset.id;
      }

      const mlRes = await api.post(
        `/v1/researcher/project-scenario`,
        reqBody,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // Handle 202 Processing (Engine Training)
      if (mlRes.status === 202) {
        setScenarioMeta({ confidence: `🟡 ${t('chart_pending')}` });
        // Retry after 5 seconds
        setTimeout(() => handlePredict(), 5000);
        return;
      }

      const mlData = mlRes.data.data;
      setScenarioMeta(mlData);
      setIsSynthetic(mlData.is_synthetic ?? true);

      // Merge data for Quinquennial chart using the new unified structure
      const histDict = Object.fromEntries(mlData.historical.map((h: any) => [h.year, h.population]));
      const refDict  = Object.fromEntries(mlData.reference.map((r: any) => [r.year, r.value]));
      const projDict = Object.fromEntries(mlData.projection.map((p: any) => [p.year, p]));
      const offDict  = Object.fromEntries(mlData.official_baseline.map((o: any) => [o.year, o.value]));

      const merged: any[] = [];
      let lastKnownActual = 0;

      for (let yr = 2009; yr <= 2050; yr++) {
        const histVal = histDict[yr];
        if (histVal !== undefined && histVal !== null && histVal !== 0) {
          lastKnownActual = histVal;
        }

        const proj = projDict[yr];
        let forecastValue = null;
        let ciValue = null;

        if (proj && proj.value !== null) {
          forecastValue = +(proj.value / 1_000_000).toFixed(2);
          ciValue = [
            +(proj.lower / 1_000_000).toFixed(2),
            +(proj.upper / 1_000_000).toFixed(2)
          ];
        }

        merged.push({
          year: yr.toString(),
          actual: lastKnownActual > 0 ? +(lastKnownActual / 1_000_000).toFixed(2) : null,
          forecast: forecastValue,
          prophet_ref: refDict[yr] ? +(refDict[yr] / 1_000_000).toFixed(2) : null,
          official_ref: offDict[yr] ? +(offDict[yr] / 1_000_000).toFixed(2) : null,
          ci_band: ciValue
        });
      }

      setChartData(merged);
      setHasRun(true);
    } catch (err: any) {
      console.error("Simulation failed", err);
      toast({
        title: t("error", {}, "Error"),
        description: t('researcher_ai_model_offline'),
        variant: "destructive"
      });
      setModelType("baseline");
    } finally {
      setLoading(false);
    }
  }, [isf, e0, tmi, selectedRegion, selectedProvince, modelType, t, selectedDataset, toast]);

  // ── Handle Dataset Selection & Column Audit ─────────────────────────────────
  const handleDatasetSelect = useCallback(async (dataset: DatasetMeta | null) => {
    setSelectedDataset(dataset);
    setBaselineData(null);
    setSelectedProvince("National");
    if (!dataset) {
      setAuditResult(null);
      return;
    }

    try {
      // TECHNICAL REQUIREMENT: Use Backend HealthCheck instead of hardcoded CSV column scan
      const { data: health } = await api.get(`/v1/ml/dataset-health/${dataset.id}`);
      
      const errors: any[] = [];
      if (!health.is_compatible) {
        // Map backend indicators back to the expected error format
        if (health.missing_indicators && health.missing_indicators.length > 0) {
          errors.push({ 
            type: 'missing_cols', 
            cols: health.missing_indicators 
          });
        }
        // Check for row/year count minimums
        if (health.year_count < 5) {
          errors.push({ 
            type: 'too_few_years', 
            count: health.year_count || 0 
          });
        }
      }

      setAuditResult({ 
        isCompatible: health.is_compatible, 
        errors 
      });
    } catch (err) {
      console.error("Dataset health check failed", err);
      // Fallback: mark as incompatible if check fails
      setAuditResult({ 
        isCompatible: false, 
        errors: [{ type: 'server_error' }] 
      });
    }
  }, []);

  // ── Callback: Real baseline values loaded from API ────────────────────────
  const handleBaselineLoaded = useCallback((baseline: BaselineData) => {
    setBaselineData(baseline);
    // Auto-populate sliders with REAL values from the dataset's last year
    if (baseline.ISF !== null)  setIsf([parseFloat(baseline.ISF.toFixed(2))]);
    if (baseline.e0  !== null)  setE0([parseFloat(baseline.e0.toFixed(1))]);
    if (baseline.TMI !== null)  setTmi([parseFloat(baseline.TMI.toFixed(1))]);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Don't auto-run if dataset is selected but incompatible
    if (auditResult && !auditResult.isCompatible) return;
    
    debounceRef.current = setTimeout(() => handlePredict(), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [handlePredict, auditResult]);

  const handleExportSnapshot = async () => {
    if (!snapshotRef.current) return;
    const canvas = await html2canvas(snapshotRef.current, { scale: 2, useCORS: true });
    const link = document.createElement("a");
    link.download = `Scenario_${selectedRegion}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const lastBaseline = chartData.at(-1)?.actual ?? 0;
  const lastForecast = chartData.at(-1)?.forecast ?? 0;
  const divergence = (lastForecast - lastBaseline).toFixed(2);

  return (
    <div className="max-w-7xl mx-auto mt-4 px-2 space-y-6">
      <div className={`flex justify-between items-end ${isRtl ? 'flex-row-reverse text-end' : 'text-start'}`}>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('researcher_scenario_vs_baseline')}</h1>
          <p className="text-sm text-muted-foreground">{t('researcher_transformation_levers')} · {t('researcher_quinquennial_standard')}</p>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[10px] px-2 py-1 bg-primary/10 text-primary font-bold rounded-full uppercase border border-primary/20">
             {t('researcher_strategic_mode')}
           </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        <Card className="border-white/20 shadow-sm overflow-hidden bg-white/70 backdrop-blur-md dark:bg-black/40">
          <CardHeader className={`p-4 bg-muted/30 border-b border-border/40 ${isRtl ? 'text-end' : 'text-start'}`}>
            <CardTitle className={`text-xs font-bold flex items-center gap-2 uppercase tracking-wider ${isRtl ? 'flex-row-reverse' : ''}`}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : "text-muted-foreground"}`} />
              {t('researcher_power_levers')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-6 text-start">
            <DatasetDropdown
              onDatasetSelect={handleDatasetSelect}
              onBaselineLoaded={handleBaselineLoaded}
            />
            <DatasetErrorPanel auditResult={auditResult} />

            {/* Province selector — populated from dataset when available, otherwise region map */}
            <div className="space-y-2">
              <label className={`text-[11px] font-semibold text-foreground uppercase tracking-tight flex items-center gap-1.5 ${isRtl ? 'flex-row-reverse text-end' : 'text-start'}`}>
                <MapPin className="w-3 h-3 text-muted-foreground" />
                {baselineData && baselineData.provinces.length > 0
                  ? t('researcher_province_from_dataset')
                  : t('researcher_analysis_region')
                }
              </label>

              {baselineData && baselineData.provinces.length > 0 ? (
                // Dataset-driven province selector
                <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                  <SelectTrigger className={`h-9 text-xs bg-background border-primary/30 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="National" className="text-xs font-semibold">
                      {t('researcher_national_aggregate', { count: baselineData.provinces.length })}
                    </SelectItem>
                    {baselineData.provinces.map(prov => (
                      <SelectItem key={prov} value={prov} className="text-xs">
                        {prov}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                // Fallback: static region map
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className={`h-9 text-xs bg-background ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REGION_MAP).map(([orig, key]) => (
                      <SelectItem key={orig} value={orig} className="text-xs">
                        {t(key as any)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className={`text-[11px] font-semibold text-foreground uppercase tracking-tight block ${isRtl ? 'text-end' : 'text-start'}`}>{t('researcher_predictive_model', {}, 'Predictive Model')}</label>
              <Select value={modelType} onValueChange={(v: any) => setModelType(v)}>
                <SelectTrigger className={`h-9 text-xs bg-background border-primary/20 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baseline" className="text-xs">
                    <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <MapPin className="w-3 h-3 text-emerald-500" />
                      <span>{t('researcher_model_baseline', {}, 'Reference Baseline (Official)')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="prophet" className="text-xs">
                    <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <BarChart2 className="w-3 h-3 text-purple-500" />
                      <span>{t('researcher_model_prophet', {}, 'Facebook Prophet (Statistical)')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ensemble" className="text-xs">
                    <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Brain className="w-3 h-3 text-blue-500 animate-pulse" />
                      <span>{t('researcher_model_ensemble', {}, 'Ensemble AI (Hybrid)')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={`space-y-6 pt-2 ${auditResult && !auditResult.isCompatible ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* ISF Slider */}
              <div className="space-y-3">
                <div className={`flex justify-between items-center text-[11px] font-bold ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <span className="text-foreground">{t('researcher_fertility_isf')}</span>
                  <span className="text-primary bg-primary/10 px-2 py-0.5 rounded italic" dir="ltr">{isf[0]} {t('researcher_kids_per_woman')}</span>
                </div>
                {baselineData?.ISF !== null && baselineData !== null && (
                  <p className={`text-[10px] text-emerald-600 dark:text-emerald-400 -mt-2 font-medium ${isRtl ? 'text-end' : 'text-start'}`}>
                    {t('researcher_baseline_value', { year: baselineData.lastYear })} {baselineData.ISF?.toFixed(2)}
                  </p>
                )}
                <Slider value={isf} onValueChange={setIsf} min={2} max={10} step={0.1} />
              </div>

              {/* e0 Slider */}
              <div className="space-y-3">
                <div className={`flex justify-between items-center text-[11px] font-bold ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <span className="text-foreground">{t('researcher_health_e0')}</span>
                  <span className="text-primary bg-primary/10 px-2 py-0.5 rounded italic" dir="ltr">{e0[0]} {t('unit_years')}</span>
                </div>
                {baselineData?.e0 !== null && baselineData !== null && (
                  <p className={`text-[10px] text-emerald-600 dark:text-emerald-400 -mt-2 font-medium ${isRtl ? 'text-end' : 'text-start'}`}>
                    {t('researcher_baseline_value', { year: baselineData.lastYear })} {baselineData.e0?.toFixed(1)} {t('researcher_baseline_yrs')}
                  </p>
                )}
                <Slider value={e0} onValueChange={setE0} min={40} max={85} step={0.5} />
              </div>

              {/* TMI Slider */}
              <div className="space-y-3">
                <div className={`flex justify-between items-center text-[11px] font-bold ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <span className="text-foreground">{t('researcher_mortality_tmi')}</span>
                  <span className="text-primary bg-primary/10 px-2 py-0.5 rounded italic" dir="ltr">{tmi[0]} {t('researcher_permille_unit')}</span>
                </div>
                {baselineData?.TMI !== null && baselineData !== null && (
                  <p className={`text-[10px] text-emerald-600 dark:text-emerald-400 -mt-2 font-medium ${isRtl ? 'text-end' : 'text-start'}`}>
                    {t('researcher_baseline_value', { year: baselineData.lastYear })} {baselineData.TMI?.toFixed(1)}‰
                  </p>
                )}
                <Slider value={tmi} onValueChange={setTmi} min={20} max={150} step={1} />
              </div>
            </div>

            {/* ── Synthetic / Preview Mode Warning Banner ─────────────── */}
            {hasRun && isSynthetic && (
              <div className={`flex items-start gap-2.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 ${isRtl ? 'flex-row-reverse text-end' : 'text-start'}`}>
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                  {t('researcher_synthetic_warning')}
                </p>
              </div>
            )}

            {hasRun && scenarioMeta && (
              <div className="pt-4 border-t border-border/40 space-y-4">
                  <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> {t('researcher_ai_quality_score')}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600">{(scenarioMeta.quality_score * 100).toFixed(1)}%</span>
                  </div>
                 <FeatureImportancePanel fi={scenarioMeta.feature_importance} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4" ref={snapshotRef}>
          <Card className="shadow-sm border-white/20 bg-white/70 dark:bg-black/40 backdrop-blur-md relative overflow-hidden">
            {loading && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/40 dark:bg-black/50 backdrop-blur-md transition-all duration-300">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-extrabold antialiased text-foreground drop-shadow-md tracking-wider">
                    {t('calculating_projection', {}, 'Calculating Projection...')}
                  </p>
                </div>
              </div>
            )}
            <CardHeader className={`p-4 flex flex-row items-center justify-between border-b border-border/40 pb-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className={isRtl ? 'text-end' : 'text-start'}>
                <CardTitle className="text-sm font-extrabold antialiased text-foreground">{t('researcher_scenario_vs_baseline')}</CardTitle>
                <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest mt-0.5" dir="auto">
                  {t('researcher_quinquennial_standard')} · {t((REGION_MAP[selectedRegion] || 'region_tchad') as any)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* PREVIEW badge — visible when engine is using synthetic 2009 baseline */}
                {hasRun && isSynthetic && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold rounded uppercase border border-amber-500/30 tracking-wide">
                    PREVIEW
                  </span>
                )}
                <button
                  onClick={handleExportSnapshot}
                  className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  aria-label="Export snapshot"
                  title="Export snapshot"
                >
                  <Camera className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-6 min-h-[500px]">
               <PredictiveChart 
                 data={chartData} 
                 baselineName={t('label_baseline')} 
                 forecastName={
                   modelType === "ensemble"
                     ? t('researcher_model_ensemble', {}, 'Ensemble AI (Hybrid)')
                     : modelType === "prophet"
                     ? t('researcher_model_prophet', {}, 'Facebook Prophet (Statistical)')
                     : t('researcher_model_baseline', {}, 'Reference Baseline')
                 }
                 confidence={scenarioMeta?.confidence} 
                 showProphet={modelType !== "baseline"}
                 modelType={modelType}
               />
               
               <div className={`mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 ${isRtl ? 'text-end' : 'text-start'}`}>
                 <div className={`p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                   <Brain className="w-5 h-5 text-primary mt-1" />
                   <div>
                     <p className="text-xs font-extrabold antialiased text-primary">
                       {t('researcher_dynamic_analysis', {}, 'Dynamic Simulation:')}{' '}
                       {modelType === 'ensemble'
                         ? t('researcher_model_ensemble', {}, 'Ensemble AI (Hybrid)')
                         : modelType === 'prophet'
                         ? t('researcher_model_prophet', {}, 'Facebook Prophet (Statistical)')
                         : t('researcher_model_baseline', {}, 'Reference Baseline (Official)')}
                     </p>
                     <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed antialiased" dir="auto">
                        {modelType === "baseline" ? (
                          t('researcher_projected_reach_baseline', { value: lastBaseline })
                        ) : (
                          <>
                            {t('researcher_projected_reach_forecast', { value: lastForecast })}{' '}
                            <span className={`font-extrabold antialiased ${+divergence >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                              {+divergence >= 0 ? `+${divergence}` : divergence} {t('unit_millions')}
                            </span>{' '}
                            {t('researcher_compared_to_baseline')}
                          </>
                        )}
                      </p>
                   </div>
                 </div>
                 
                 <div className="p-4 rounded-xl border border-border/40 backdrop-blur-sm bg-white/30 dark:bg-black/20">
                   <p className="text-xs font-extrabold antialiased">{t('researcher_methodological_note', {}, 'Methodological Note')}</p>
                   <p className={`text-[10px] text-muted-foreground mt-1 leading-relaxed antialiased ${isRtl ? 'text-end' : 'text-start'}`}>
                     {t('researcher_methodological_detail')}
                   </p>
                 </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Scenarios;
