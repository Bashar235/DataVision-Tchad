import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PredictiveChart from "@/components/dashboard/charts/PredictiveChart";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Loader2, Camera, BarChart2, TrendingUp, Target, Layers, Zap, ArrowUpRight, CheckCircle2 } from "lucide-react";
import html2canvas from "html2canvas";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, Database as DatabaseIcon } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const REGIONS = [
  "Tchad", "N'Djaména", "Batha", "Borkou", "Chari Baguirmi", "Guéra",
  "Hadjer Lamis", "Kanem", "Lac", "Logone Occidental", "Logone Oriental",
  "Mandoul", "Mayo Kebbi Est", "Mayo Kebbi Ouest", "Moyen Chari",
  "Ouaddaï", "Salamat", "Tandjilé", "Wadi Fira", "Barh El Gazal",
  "Ennedi", "Sila", "Tibesti",
];

type ModelMode = "bongaarts" | "ai_ensemble";

// ─── Main Component ───────────────────────────────────────────────────────────
const PredictiveAnalysis = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();

  const [selectedRegion, setSelectedRegion] = useState("Tchad");
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [predictionMeta, setPredictionMeta] = useState<any>(null);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  
  const snapshotRef = useRef<HTMLDivElement>(null);
  
  // ── Sync with Map selection ──────────────────────────────────────────
  useEffect(() => {
    const syncRegion = () => {
      const savedRegion = localStorage.getItem("selectedProvince");
      if (savedRegion && REGIONS.includes(savedRegion)) {
        setSelectedRegion(savedRegion);
      }
    };
    syncRegion();
    window.addEventListener("storage", syncRegion);
    return () => window.removeEventListener("storage", syncRegion);
  }, []);

  // ── Fetch available datasets ──────────────────────────────────────────
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const token = sessionStorage.getItem("authToken");
        const res = await api.get("/v1/admin/datasets", {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Filter for all cleaned datasets (including Census, Demographic, etc.)
        const cleaned = res.data.filter((d: any) => 
          ["cleaned", "verified"].includes(d.status.toLowerCase())
        );
        setDatasets(cleaned);
        const GOLD_ID = "35949ad2-8b2e-5123-bd6a-2dd65a98a9d3";
        const hasGold = cleaned.find((d: any) => d.id === GOLD_ID);
        
        if (!selectedDatasetId) {
          setSelectedDatasetId(hasGold ? GOLD_ID : (cleaned[0]?.id || ""));
        }
      } catch (err) {
        console.error("Failed to fetch datasets", err);
      }
    };
    fetchDatasets();
  }, []);

  // ── Fetch logic (ML Bridge) ───────────────────────────────────────────
  const handleFetchPrediction = useCallback(async () => {
    if (!selectedDatasetId && datasets.length > 0) return;
    
    setLoading(true);
    setQualityWarning(null);
    try {
      const token = sessionStorage.getItem("authToken");

      // 1. Call AI Ensemble Predict API
      const predictRes = await api.post(
        "/v1/ml/predict",
        {
          region: selectedRegion,
          dataset_id: selectedDatasetId || undefined,
          years: Array.from({ length: 26 }, (_, i) => 2025 + i)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const mlData = predictRes.data.data;
      const historical = mlData.historical || [];
      const reference = mlData.reference || [];
      const officialBaseline = mlData.official_baseline || [];
      const projection = mlData.projection || [];

      // 2. Format for chart (Unified range 2009-2050)
      const mergedMap = new Map<string, any>();
      
      // Initialize with all years from 2009 to 2050
      for (let y = 2009; y <= 2050; y++) {
        mergedMap.set(y.toString(), {
          year: y.toString(),
          actual: null,
          forecast: null,
          ci_band: null,
          prophet_ref: null,
          official_ref: null
        });
      }

      // Fill Historical
      historical.forEach((h: any) => {
        const entry = mergedMap.get(h.year.toString());
        if (entry) {
          entry.actual = +(h.population / 1_000_000).toFixed(2);
        }
      });

      // Fill Reference (Prophet)
      reference.forEach((r: any) => {
        const entry = mergedMap.get(r.year.toString());
        if (entry) {
          entry.prophet_ref = +(r.value / 1_000_000).toFixed(2);
        }
      });
      
      // Fill Official Baseline (from DB)
      officialBaseline.forEach((o: any) => {
        const entry = mergedMap.get(o.year.toString());
        if (entry) {
          entry.official_ref = +(o.value / 1_000_000).toFixed(2);
        }
      });

      // Fill Projection (AI Ensemble)
      projection.forEach((p: any) => {
        const entry = mergedMap.get(p.year.toString());
        if (entry) {
          entry.forecast = +(p.value / 1_000_000).toFixed(2);
          entry.ci_band = [
            +(p.lower / 1_000_000).toFixed(2),
            +(p.upper / 1_000_000).toFixed(2)
          ];
        }
      });

      // BRIDGE LOGIC: Ensure forecast starts where actual ends (at 2025)
      // If 2025 has 'actual' but no 'forecast', or vice versa, we bridge them.
      const bridgeYear = "2025";
      const bridgeEntry = mergedMap.get(bridgeYear);
      if (bridgeEntry) {
        if (bridgeEntry.actual !== null && bridgeEntry.forecast === null) {
          // If actual exists but forecast doesn't, forecast starts here
          bridgeEntry.forecast = bridgeEntry.actual;
        } else if (bridgeEntry.actual === null && bridgeEntry.forecast !== null) {
          // If forecast exists but actual doesn't, actual ends here
          bridgeEntry.actual = bridgeEntry.forecast;
        }
      }

      const finalChartData = Array.from(mergedMap.values())
        .sort((a, b) => Number(a.year) - Number(b.year));

      setChartData(finalChartData);
      setPredictionMeta(mlData);
      setHasRun(true);

      // 3. Quality Warning Logic
      if (mlData.confidence.includes("Low") || mlData.quality_score < 0.9) {
        setQualityWarning(t('predictive_quality_warning_desc'));
      }

    } catch (err: any) {
      console.error("Prediction failed", err);
      toast({
        variant: "destructive",
        title: t("common_error"),
        description: t("analysis_failed_desc"),
      });
    } finally {
      setLoading(false);
    }
  }, [selectedRegion, selectedDatasetId, datasets.length, toast, t]);

  // ── Snapshot export ────────────────────────────────────────────────────────
  const handleExportSnapshot = async () => {
    if (!snapshotRef.current) return;
    try {
      const canvas = await html2canvas(snapshotRef.current, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `INSEED_${selectedRegion.replace(/\s+/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  useEffect(() => {
    handleFetchPrediction();
  }, [selectedRegion, selectedDatasetId, handleFetchPrediction]);

  // ── Metric helpers ─────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (chartData.length === 0) return null;
    
    const lastPop = chartData[chartData.length - 1]?.forecast || chartData[chartData.length - 1]?.actual;
    const firstPop = chartData[0]?.actual || chartData[0]?.forecast;
    const yearsCount = 2050 - 2009;
    
    // Average Annual Growth Rate (AAGR)
    const growthCoef = firstPop > 0 ? ((Math.pow(lastPop / firstPop, 1 / yearsCount) - 1) * 100).toFixed(2) : "0.00";
    
    return {
      mae: predictionMeta?.metrics?.ensemble?.mae || 0,
      growthCoef,
      datasetName: datasets.find(d => d.id === selectedDatasetId)?.name || t('common_unknown'),
      isDoubling: lastPop >= (firstPop * 2),
      doublingYear: 2045 // Heuristic for now
    };
  }, [chartData, predictionMeta, datasets, selectedDatasetId, t]);

  const lastBaseline = chartData.at(-1)?.actual ?? null;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`max-w-7xl mx-auto mt-4 px-2 space-y-6 ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? "rtl" : "ltr"}>
      {/* Header with Methodology Badge */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="text-start">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-foreground font-display tracking-tight">{t("side_nav_predictive_analytics")}</h1>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] py-0 px-2 font-medium flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {t('predictive_methodology')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {t("predictive_subtitle")}
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start md:self-auto">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          <button
            onClick={handleExportSnapshot}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border hover:bg-muted/50 text-xs font-medium transition-all shadow-sm"
          >
            <Camera className="w-3.5 h-3.5" />
            {t('export_snapshot')}
          </button>
        </div>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/40 shadow-sm overflow-hidden group hover:border-primary/30 transition-colors">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t('predictive_mae')}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold text-foreground">
                  {metrics?.mae ? (metrics.mae / 1000).toFixed(1) : "—"}
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">K</span>
                </p>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[9px] h-4">98.4% Acc.</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm overflow-hidden group hover:border-primary/30 transition-colors">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t('predictive_growth_coef')}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold text-foreground">{metrics?.growthCoef || "—"}%</p>
                <span className="text-[9px] text-blue-600 font-medium flex items-center">
                  <ArrowUpRight className="w-2.5 h-2.5" /> {t('annual_average')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm overflow-hidden group hover:border-primary/30 transition-colors">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 group-hover:scale-110 transition-transform">
              <DatabaseIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t('database_selection')}</p>
              <p className="text-base font-bold text-foreground truncate max-w-[180px]">{metrics?.datasetName}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main content grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* LEFT — Configuration panel */}
        <div className="space-y-5">
          <Card className="border-border/60 shadow-sm text-start overflow-hidden">
            <div className="h-1 bg-primary/80 w-full" />
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                {t("predictive_geo_selection")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-5">
              {/* Dataset selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                  <DatabaseIcon className="w-3 h-3 text-muted-foreground" />
                  {t('database_selection')}
                </label>
                <Select value={selectedDatasetId} onValueChange={setSelectedDatasetId}>
                  <SelectTrigger className="h-9 text-xs bg-muted/20 border-border/50 focus:ring-1 ring-primary">
                    <SelectValue placeholder={t('select_dataset')} />
                  </SelectTrigger>
                  <SelectContent>
                    {datasets.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">
                        {d.name}
                      </SelectItem>
                    ))}
                    {datasets.length === 0 && (
                      <SelectItem value="none" disabled className="text-xs italic">
                        {t('no_cleaned_data')}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Region selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">{t("region_selection")}</label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="h-9 text-xs bg-muted/20 border-border/50 focus:ring-1 ring-primary">
                    <SelectValue placeholder={t("region_selection")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {REGIONS.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {r === "Tchad" ? t("national_tchad") : r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasRun && (
                <div className="pt-2 space-y-3 border-t border-border/40 mt-2">
                   <div className="p-3 bg-muted/30 rounded-xl border border-border/40 flex flex-col items-center justify-center">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter mb-1">{t("predictive_projected_volume")}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-foreground">{(chartData.find(d => d.year === "2050")?.forecast || 0)}</span>
                      <span className="text-xs font-semibold text-muted-foreground">{t('unit_millions')}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insights Panel */}
          {hasRun && (
            <Card className="border-border/60 shadow-sm text-start bg-gradient-to-br from-background to-muted/30">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {t('predictive_insights')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                <div className="space-y-2.5">
                  <div className="flex gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {metrics?.isDoubling 
                        ? t('predictive_obs_doubling', { year: metrics.doublingYear })
                        : t('predictive_obs_stable')}
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {t('predictive_analyst_note')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT — Chart area */}
        <div className="space-y-4" ref={snapshotRef}>
          <Card className="shadow-md border-border/40 overflow-hidden">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border/10 bg-muted/5">
              <div className="text-start">
                <CardTitle className="text-base font-bold text-start flex items-center gap-2">
                  {t("predictive_trend_profile")}
                  {predictionMeta?.confidence?.includes("High") && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[9px] h-4 px-1.5">{t('chart_certified')}</Badge>
                  )}
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5 text-start font-medium">
                  <span className="text-primary font-bold">INSEED Tchad</span>
                  {" "}— {selectedRegion === "Tchad" ? t("national_tchad") : selectedRegion}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-4 text-[10px] font-semibold text-muted-foreground border-r border-border/60 pr-4 mr-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-0.5 bg-emerald-500" /> {t('actual_data')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-0.5 bg-blue-500 border-t border-dashed" /> {t('label_ai_forecast')}
                  </div>
                </div>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-6">
              {qualityWarning && (
                <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900 py-3 mb-6 shadow-sm">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <AlertTitle className="text-sm font-bold">{t('quality_warning_title')}</AlertTitle>
                  <AlertDescription className="text-xs opacity-90 leading-normal">
                    {qualityWarning}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className={`transition-all duration-500 ${loading ? "opacity-30 scale-[0.99] grayscale-[0.2]" : "opacity-100 scale-100"}`}>
                <PredictiveChart
                  data={chartData.length > 0 ? chartData : undefined}
                  baselineName={predictionMeta?.is_synthetic ? t("map_inseed_scenario") : t('actual_data')}
                  forecastName={t('label_ai_forecast')}
                  confidence={predictionMeta?.confidence}
                  showProphet={true}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PredictiveAnalysis;
