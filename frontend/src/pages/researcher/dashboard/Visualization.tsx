import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import api, {
  getSpatialMeta,
  getResearcherViz
} from "@/services/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Loader2, 
  RefreshCcw, 
  Camera, 
  Eye, 
  EyeOff, 
  Info, 
  TrendingUp, 
  Activity, 
  LineChart, 
  Grid, 
  Dot, 
  Download, 
  Share2 
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  Legend
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

// ─── Custom Styles & Colors ──────────────────────────────────────────────────
const REGION_COLORS = [
  "#4f46e5", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#e11d48", // Rose
  "#06b6d4", // Cyan
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#14b8a6"  // Teal
];

const getRegionColor = (region: string, idx: number) => {
  if (region === "Tchad" || region === "National") return "#3b82f6";
  return REGION_COLORS[idx % REGION_COLORS.length];
};

const INDICATORS = [
  { key: "population", label: "ind_population", unit: "M", color: "#4f46e5" },
  { key: "gdp", label: "ind_gdp", unit: "$B", color: "#8b5cf6" },
  { key: "urbanisation", label: "ind_urbanisation", unit: "%", color: "#3b82f6" },
  { key: "fertility", label: "ind_fertility", unit: " children/woman", color: "#f59e0b" },
  { key: "lifeexp", label: "ind_lifeexp", unit: " years", color: "#10b981" },
  { key: "literacy", label: "ind_literacy", unit: "%", color: "#0284c7" },
  { key: "water", label: "ind_water", unit: "%", color: "#0d9488" },
  { key: "infant_mortality", label: "ind_infant_mortality", unit: "‰", color: "#e11d48" }
];

const getIndicatorName = (key: string, t: any) => {
  const match = INDICATORS.find(i => i.key === key);
  return match ? t(match.label) : key;
};

const formatIndicatorValue = (key: string, val: number) => {
  const match = INDICATORS.find(i => i.key === key);
  if (!match) return val.toString();
  if (key === "population") return `${val.toFixed(2)}M`;
  if (key === "gdp") return `$${val.toFixed(1)}B`;
  if (key === "fertility") return `${val.toFixed(2)}`;
  if (key === "lifeexp") return `${val.toFixed(1)}`;
  if (key === "infant_mortality") return `${val.toFixed(1)}‰`;
  return `${val.toFixed(1)}${match.unit}`;
};

const Visualization = () => {
  const { t, isRtl } = useLanguage();
  
  // ─── States ──────────────────────────────────────────────────────────────
  const [indicator1, setIndicator1] = useState<string>("population");
  const [indicator2, setIndicator2] = useState<string>("gdp");
  const [selectedRegions, setSelectedRegions] = useState<string[]>(["Tchad"]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  
  const [normalize, setNormalize] = useState<boolean>(true);
  const [chartMode, setChartMode] = useState<"area" | "scatter" | "heatmap">("area");
  
  const [startYear, setStartYear] = useState<number>(2009);
  const [endYear, setEndYear] = useState<number>(2050);
  
  const [rawData, setRawData] = useState<Record<string, { year: number; value: number }[]>>({});
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  
  const [loading, setLoading] = useState<boolean>(false);
  const [metaLoading, setMetaLoading] = useState<boolean>(true);
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);
  const [presentationMode, setPresentationMode] = useState<boolean>(false);

  const chartRef = useRef<HTMLDivElement>(null);

  // ─── Fetch Regions on Mount ──────────────────────────────────────────────
  useEffect(() => {
    getSpatialMeta()
      .then(meta => {
        if (meta?.regions?.length) setAvailableRegions(meta.regions);
      })
      .catch(() => setAvailableRegions([]))
      .finally(() => setMetaLoading(false));
  }, []);

  // ─── Fetch Analytics Data ──────────────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    if (selectedRegions.length === 0) return;
    setLoading(true);
    try {
      const datasetId = '35949ad2-8b2e-5123-bd6a-2dd65a98a9d3'; // INSEED official gold standard
      
      const indicatorsToFetch = [indicator1];
      if (indicator2 && indicator2 !== "none" && indicator2 !== indicator1) {
        indicatorsToFetch.push(indicator2);
      }

      const queries: { region: string; indicatorKey: string; promise: Promise<any> }[] = [];
      
      selectedRegions.forEach(region => {
        indicatorsToFetch.forEach(indKey => {
          const indConfig = INDICATORS.find(i => i.key === indKey);
          if (indConfig) {
            queries.push({
              region,
              indicatorKey: indKey,
              promise: getResearcherViz({
                indicator: indKey,
                region,
                start_year: 2009,
                end_year: 2050,
                dataset_id: datasetId
              })
            });
          }
        });
      });

      const results = await Promise.allSettled(queries.map(q => q.promise));
      const newRawData: Record<string, { year: number; value: number }[]> = {};

      results.forEach((res, idx) => {
        const query = queries[idx];
        if (res.status === "fulfilled" && res.value?.data) {
          const points = res.value.data.map((d: any) => {
            let val = Number(d.value);
            if (query.indicatorKey === "population") {
              val = val / 1_000_000; // Scaled to Millions
            }
            return { year: Number(d.year), value: val };
          });
          newRawData[`${query.region}_${query.indicatorKey}`] = points;
        }
      });

      setRawData(newRawData);
    } catch (err) {
      console.error("[EDA Suite] data loading failed", err);
    } finally {
      setLoading(false);
    }
  }, [indicator1, indicator2, selectedRegions, t]);

  useEffect(() => {
    if (!metaLoading) {
      fetchAllData();
    }
  }, [fetchAllData, metaLoading]);

  // ─── Data Normalization & Aligned Calculations ───────────────────────────
  const { chartData, minMaxValues } = useMemo(() => {
    const minMax: Record<string, { min: number; max: number }> = {};
    
    INDICATORS.forEach(ind => {
      const allVals: number[] = [];
      selectedRegions.forEach(region => {
        const key = `${region}_${ind.key}`;
        const data = rawData[key] || [];
        data.forEach(d => {
          if (d.year >= startYear && d.year <= endYear) {
            allVals.push(d.value);
          }
        });
      });
      if (allVals.length > 0) {
        minMax[ind.key] = {
          min: Math.min(...allVals),
          max: Math.max(...allVals)
        };
      } else {
        minMax[ind.key] = { min: 0, max: 1 };
      }
    });

    const alignedPoints: any[] = [];
    for (let y = startYear; y <= endYear; y++) {
      const pt: any = { year: y };
      let hasData = false;
      
      selectedRegions.forEach(region => {
        [indicator1, indicator2].forEach(indKey => {
          if (!indKey || indKey === "none") return;
          const key = `${region}_${indKey}`;
          const yearData = rawData[key]?.find(d => d.year === y);
          if (yearData !== undefined) {
            hasData = true;
            const originalVal = yearData.value;
            pt[`${region}_${indKey}`] = originalVal;
            
            const mm = minMax[indKey];
            const range = mm.max - mm.min;
            const normVal = range > 0 ? (originalVal - mm.min) / range : 0;
            pt[`${region}_${indKey}_norm`] = Number(normVal.toFixed(4));
          }
        });
      });
      if (hasData) {
        alignedPoints.push(pt);
      }
    }

    return { chartData: alignedPoints, minMaxValues: minMax };
  }, [rawData, indicator1, indicator2, selectedRegions, startYear, endYear]);

  // ─── Pearson Correlation Coefficient Math ─────────────────────────────────
  const pearsonResult = useMemo(() => {
    if (!indicator2 || indicator2 === "none" || indicator1 === indicator2) return null;
    
    const xVals: number[] = [];
    const yVals: number[] = [];
    
    chartData.forEach(pt => {
      selectedRegions.forEach(region => {
        const x = pt[`${region}_${indicator1}`];
        const y = pt[`${region}_${indicator2}`];
        if (x !== undefined && y !== undefined) {
          xVals.push(x);
          yVals.push(y);
        }
      });
    });

    if (xVals.length < 3) return { r: 0, label: t("viz_insufficient_data"), variant: "secondary" as const };
    
    const n = xVals.length;
    const sumX = xVals.reduce((a, b) => a + b, 0);
    const sumY = yVals.reduce((a, b) => a + b, 0);
    const sumXY = xVals.reduce((sum, x, i) => sum + x * yVals[i], 0);
    const sumX2 = xVals.reduce((sum, x) => sum + x * x, 0);
    const sumY2 = yVals.reduce((sum, y) => sum + y * y, 0);
    
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    const rVal = den === 0 ? 0 : num / den;
    const r = Number(rVal.toFixed(3));
    
    let label = t("viz_weak_no_corr");
    let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
    
    if (r > 0.7) {
      label = t("viz_strong_positive");
      variant = "default" as const;
    } else if (r < -0.7) {
      label = t("viz_strong_negative");
      variant = "destructive" as const;
    } else if (Math.abs(r) > 0.3) {
      label = t("viz_moderate");
      variant = "secondary" as const;
    }
    
    return { r, label, variant };
  }, [chartData, indicator1, indicator2, selectedRegions, t]);

  // ─── Growth Leader Math ──────────────────────────────────────────────────
  const growthLeader = useMemo(() => {
    let bestRegion = "";
    let bestGrowth = -Infinity;
    
    selectedRegions.forEach(region => {
      const key = `${region}_${indicator1}`;
      const validData = chartData
        .map(pt => ({ year: pt.year, val: pt[key] }))
        .filter(d => d.val !== undefined);
        
      if (validData.length >= 2) {
        const initial = validData[0].val;
        const final = validData[validData.length - 1].val;
        if (initial > 0) {
          const growth = ((final - initial) / initial) * 100;
          if (growth > bestGrowth) {
            bestGrowth = growth;
            bestRegion = region;
          }
        }
      }
    });
    
    return bestRegion ? { region: bestRegion, value: Number(bestGrowth.toFixed(1)) } : null;
  }, [chartData, indicator1, selectedRegions]);

  // ─── Volatility Index Math (σ of YoY % Changes) ──────────────────────────
  const volatilityIndex = useMemo(() => {
    let maxVolRegion = "";
    let maxVolValue = -1;
    
    selectedRegions.forEach(region => {
      const key = `${region}_${indicator1}`;
      const validData = chartData
        .map(pt => ({ year: pt.year, val: pt[key] }))
        .filter(d => d.val !== undefined);
        
      if (validData.length >= 3) {
        const yoyChanges: number[] = [];
        for (let i = 1; i < validData.length; i++) {
          const prev = validData[i-1].val;
          const curr = validData[i].val;
          if (prev > 0) {
            yoyChanges.push((curr - prev) / prev);
          }
        }
        
        if (yoyChanges.length > 1) {
          const mean = yoyChanges.reduce((a, b) => a + b, 0) / yoyChanges.length;
          const variance = yoyChanges.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / yoyChanges.length;
          const stdDev = Math.sqrt(variance) * 100;
          if (stdDev > maxVolValue) {
            maxVolValue = stdDev;
            maxVolRegion = region;
          }
        }
      }
    });
    
    return maxVolRegion ? { region: maxVolRegion, value: Number(maxVolValue.toFixed(2)) } : null;
  }, [chartData, indicator1, selectedRegions]);

  // ─── Dynamic Legend Toggling ─────────────────────────────────────────────
  const toggleSeries = (regionName: string) => {
    const next = new Set(hiddenSeries);
    if (next.has(regionName)) {
      next.delete(regionName);
    } else {
      next.add(regionName);
    }
    setHiddenSeries(next);
  };

  // ─── PDF Report Generation ───────────────────────────────────────────────
  const exportPDF = async () => {
    if (!chartRef.current) return;
    setPdfGenerating(true);
    try {
      const isDark = document.documentElement.classList.contains("dark");
      const canvas = await html2canvas(chartRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: isDark ? "#0f172a" : "#ffffff"
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      
      // Page styling
      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, 0, width, height, "F");
      
      // Header Panel
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, width, 32, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text(t("viz_report_title"), 15, 12);
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(`${t("viz_report_subtitle")}  |  ${t("viz_generated_on")}: ${new Date().toLocaleDateString()}`, 15, 19);
      pdf.text(`${t("viz_regions")}: ${selectedRegions.join(", ")}  |  ${t("viz_indicators")}: ${getIndicatorName(indicator1, t)}${indicator2 && indicator2 !== "none" ? ` vs ${getIndicatorName(indicator2, t)}` : ""}`, 15, 25);
      
      // Chart positioning
      const chartWidth = 267;
      const chartHeight = 120;
      const chartX = 15;
      const chartY = 40;
      
      // Card Frame
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(chartX - 2, chartY - 2, chartWidth + 4, chartHeight + 4, 3, 3, "F");
      pdf.addImage(imgData, "PNG", chartX, chartY, chartWidth, chartHeight);
      
      // Insights Box
      const summaryY = 168;
      pdf.setFillColor(241, 245, 249);
      pdf.roundedRect(15, summaryY, width - 30, 32, 2, 2, "F");
      
      pdf.setTextColor(15, 23, 42);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(t("viz_insights_header"), 20, summaryY + 6);
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      
      let insightText1 = `${t("viz_indicator_1")}: ${getIndicatorName(indicator1, t)}`;
      if (indicator2 && indicator2 !== "none") {
        insightText1 += `  |  ${t("viz_indicator_2")}: ${getIndicatorName(indicator2, t)}`;
        if (pearsonResult) {
          insightText1 += `  |  ${t("viz_pearson_r")} = ${pearsonResult.r} (${pearsonResult.label})`;
        }
      }
      pdf.text(insightText1, 20, summaryY + 14);
      
      let insightText2 = "";
      if (growthLeader) {
        insightText2 += `${t("viz_growth_leader")} (${getIndicatorName(indicator1, t)}): ${growthLeader.region} (+${growthLeader.value}%)`;
      }
      if (volatilityIndex) {
        insightText2 += `   |   ${t("viz_volatility_index")}: ${volatilityIndex.region} (${volatilityIndex.value}%)`;
      }
      pdf.text(insightText2, 20, summaryY + 22);
      
      const cleanInd1 = indicator1.replace(/\s+/g, '_');
      const cleanInd2 = indicator2 && indicator2 !== "none" ? `_vs_${indicator2.replace(/\s+/g, '_')}` : '';
      pdf.save(`INSEED_EDA_${cleanInd1}${cleanInd2}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfGenerating(false);
    }
  };

  // ─── Heatmap Interpolator ────────────────────────────────────────────────
  const getHeatmapColor = (v: number, isDark: boolean) => {
    const val = Math.max(0, Math.min(1, Number(v) || 0));
    if (isDark) {
      // Dark Mode Scale (HSL interpolate light-teal to deep-navy)
      const h = 180 + val * (220 - 180);
      const s = 50 + val * (85 - 50);
      const l = 25 - val * (25 - 15);
      return `hsl(${h}, ${s}%, ${l}%)`;
    } else {
      // Light Mode Scale (light-teal to deep-navy)
      const h = 180 + val * (220 - 180);
      const s = 55 + val * (85 - 55);
      const l = 92 - val * (92 - 30);
      return `hsl(${h}, ${s}%, ${l}%)`;
    }
  };

  // ─── Recharts Elements ───────────────────────────────────────────────────
  const axisProps = {
    stroke: "#64748b",
    fontSize: 10,
    fontFamily: isRtl ? "Arial, sans-serif" : "inherit",
    tickLine: false,
    axisLine: false,
    reversed: isRtl
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 dark:bg-slate-900/95 border border-white/20 dark:border-white/10 rounded-xl p-4 shadow-xl backdrop-blur-md text-start space-y-2 max-w-sm">
          <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">{t('viz_year_tooltip')} {label}</p>
          <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
            {payload.map((p: any, idx: number) => {
              const dataKey = p.dataKey || "";
              const parts = dataKey.split("_");
              if (parts.length < 2) return null;
              
              const regionName = parts[0];
              const indKey = parts[1];
              const isNorm = parts.includes("norm");
              
              const originalVal = p.payload[`${regionName}_${indKey}`];
              if (originalVal === undefined) return null;
              
              const formattedVal = formatIndicatorValue(indKey, originalVal);
              const color = p.stroke || p.fill || "#4f46e5";
              
              return (
                <div key={idx} className="flex items-center gap-2 text-[11px] leading-relaxed">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {regionName} ({getIndicatorName(indKey, t)}):
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 ml-auto">
                    {formattedVal}
                    {isNorm && (
                      <span className="text-[9px] text-muted-foreground ml-1 font-normal">
                        ({p.value})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`max-w-7xl mx-auto space-y-6 mt-4 px-4 pb-12 ${isRtl ? 'rtl font-arabic' : 'ltr'}`} dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Header Panel */}
      <AnimatePresence>
        {!presentationMode && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4"
          >
            <div className="text-start">
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                {t('viz_eda_title')}
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-primary border-primary/20 bg-primary/5">
                  {t('viz_researcher_badge')}
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('viz_subtitle_advanced')}
              </p>
            </div>
            
            <div className="flex items-center gap-2 self-start md:self-auto">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportPDF} 
                disabled={pdfGenerating || loading}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                {pdfGenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {t('viz_export_pdf_btn')}
              </Button>
              
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setPresentationMode(true)}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                {t('viz_presentation_mode_btn')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Exit Banner for Presentation Mode */}
      {presentationMode && (
        <motion.div 
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900/90 dark:bg-slate-950/90 text-white rounded-full px-6 py-2 shadow-2xl backdrop-blur-md border border-white/10"
        >
          <span className="text-xs font-bold tracking-wide">{t("viz_presentation_active")}</span>
          <div className="h-4 w-px bg-white/20" />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportPDF}
            className="h-7 text-[10px] font-bold text-white bg-white/10 border-white/20 hover:bg-white/20 hover:text-white"
          >
            {t('viz_snapshot_pdf_btn')}
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setPresentationMode(false)}
            className="h-7 text-[10px] font-bold gap-1 rounded-full"
          >
            <EyeOff className="w-3 h-3" />
            {t('viz_exit_btn')}
          </Button>
        </motion.div>
      )}

      {/* Three Column Glass Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Left Filter Sidebar */}
        <AnimatePresence>
          {!presentationMode && (
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="lg:col-span-1 space-y-4"
            >
              <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl overflow-hidden text-start">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs uppercase font-extrabold text-muted-foreground tracking-wider flex items-center justify-between">
                    <span>{t("viz_variable_filters")}</span>
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4 text-xs font-medium text-slate-700 dark:text-slate-200">
                  
                  {/* Indicator 1 selection */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">{t("viz_primary_var")}</Label>
                    <Select value={indicator1} onValueChange={setIndicator1}>
                      <SelectTrigger className="h-8 text-xs bg-white/50 dark:bg-slate-800/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INDICATORS.map(ind => (
                          <SelectItem key={ind.key} value={ind.key}>{t(ind.label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Indicator 2 selection */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">{t("viz_secondary_var")}</Label>
                    <Select value={indicator2} onValueChange={setIndicator2}>
                      <SelectTrigger className="h-8 text-xs bg-white/50 dark:bg-slate-800/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("viz_none_single")}</SelectItem>
                        {INDICATORS.map(ind => (
                          <SelectItem key={ind.key} value={ind.key}>{t(ind.label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Toggle Normalization */}
                  <div className="flex items-center justify-between py-2 border-t border-b border-border/40">
                    <div className="space-y-0.5">
                      <Label htmlFor="side-norm" className="text-[11px] font-bold">{t("viz_normalize_scale")}</Label>
                      <p className="text-[9px] text-muted-foreground">{t("viz_scale_desc")}</p>
                    </div>
                    <Switch id="side-norm" checked={normalize} onCheckedChange={setNormalize} />
                  </div>

                  {/* Year Range Pickers */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">{t("viz_temporal_boundary")}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground">{t("viz_start_year")}</span>
                        <Select value={startYear.toString()} onValueChange={v => setStartYear(Number(v))}>
                          <SelectTrigger className="h-7 text-xs bg-white/50 dark:bg-slate-800/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {Array.from({ length: 42 }, (_, i) => 2009 + i).map(y => (
                              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground">{t("viz_end_year")}</span>
                        <Select value={endYear.toString()} onValueChange={v => setEndYear(Number(v))}>
                          <SelectTrigger className="h-7 text-xs bg-white/50 dark:bg-slate-800/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {Array.from({ length: 42 }, (_, i) => 2009 + i).filter(y => y >= startYear).map(y => (
                              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Region selection checklist */}
                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground flex justify-between">
                      <span>{t("viz_provinces")}</span>
                      <span className="text-[9px] font-normal text-slate-500">{t("viz_selected")}: {selectedRegions.length}</span>
                    </Label>
                    <ScrollArea className="h-[160px] rounded-md border border-border/40 bg-white/20 dark:bg-slate-900/20 p-2">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/50 p-1 rounded cursor-pointer transition-colors">
                          <input 
                            type="checkbox"
                            className="rounded border-slate-300 dark:border-slate-700 accent-primary"
                            checked={selectedRegions.includes("Tchad")}
                            onChange={() => {
                              if (selectedRegions.includes("Tchad")) {
                                setSelectedRegions(selectedRegions.filter(r => r !== "Tchad"));
                              } else {
                                if (selectedRegions.length < 6) {
                                  setSelectedRegions([...selectedRegions, "Tchad"]);
                                }
                              }
                            }}
                          />
                          <span>{t("viz_national")}</span>
                        </label>
                        {availableRegions.filter(r => r !== "Tchad").map(region => (
                          <label key={region} className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/50 p-1 rounded cursor-pointer transition-colors">
                            <input 
                              type="checkbox"
                              className="rounded border-slate-300 dark:border-slate-700 accent-primary"
                              checked={selectedRegions.includes(region)}
                              onChange={() => {
                                if (selectedRegions.includes(region)) {
                                  setSelectedRegions(selectedRegions.filter(r => r !== region));
                                } else {
                                  if (selectedRegions.length < 6) {
                                    setSelectedRegions([...selectedRegions, region]);
                                  }
                                }
                              }}
                            />
                            <span>{region}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Reset Filters button */}
                    <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setIndicator1("population");
                      setIndicator2("gdp");
                      setSelectedRegions(["Tchad"]);
                      setNormalize(true);
                      setStartYear(2009);
                      setEndYear(2050);
                    }}
                    className="w-full h-8 text-[11px] font-semibold flex items-center justify-center gap-1 bg-white/30 dark:bg-slate-900/30"
                  >
                    <RefreshCcw className="w-3 h-3" />
                    {t('viz_reset_filters_btn')}
                  </Button>

                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Canvas Area */}
        <div className={`transition-all duration-300 ${presentationMode ? 'lg:col-span-4' : 'lg:col-span-3'} space-y-6`}>
          
          {/* Main Chart Card */}
          <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl overflow-hidden relative">
            <CardHeader className="p-4 pb-2 flex flex-row flex-wrap items-center justify-between gap-4 border-b border-border/20 text-start">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">
                  {chartMode === "scatter" ? t("viz_trajectory_correlation") : t("viz_trend_canvas")}
                </CardTitle>
                <CardDescription className="text-[10px] text-muted-foreground">
                  {getIndicatorName(indicator1, t)}
                  {indicator2 && indicator2 !== "none" && ` ${t("viz_correlated_with")} ${getIndicatorName(indicator2, t)}`}
                </CardDescription>
              </div>

              {/* Chart Mode Tabs */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-border/40">
                {[
                  { mode: "area", label: t("viz_area_trend"), icon: LineChart },
                  { mode: "scatter", label: t("viz_scatter_phase"), icon: Dot },
                  { mode: "heatmap", label: t("viz_intensity_heatmap"), icon: Grid }
                ].map(t => {
                  const Icon = t.icon;
                  const active = chartMode === t.mode;
                  return (
                    <button
                      key={t.mode}
                      onClick={() => setChartMode(t.mode as any)}
                      className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                        active 
                          ? "bg-white dark:bg-slate-900 shadow-sm text-primary" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            
            {/* Chart Area */}
            <CardContent className="p-4 h-[440px] relative" ref={chartRef}>
              
              {loading && (
                <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-xs font-bold text-muted-foreground animate-pulse">{t("viz_syncing")}</span>
                  </div>
                </div>
              )}

              {chartData.length === 0 && !loading ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/50">
                  <Info className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm font-semibold">{t("viz_insufficient_data")}</p>
                  <p className="text-xs text-slate-500">{t("viz_select_region_hint")}</p>
                </div>
              ) : chartMode === "area" ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <defs>
                      {/* Gradient glow definitions */}
                      {selectedRegions.map((region, rIdx) => {
                        const color = getRegionColor(region, rIdx);
                        return (
                          <linearGradient key={region} id={`grad_${region}_${indicator1}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                    <XAxis dataKey="year" {...axisProps} />
                    
                    <YAxis 
                      yAxisId="left" 
                      {...axisProps} 
                      orientation={isRtl ? "right" : "left"}
                      tickFormatter={v => normalize ? `${v}` : formatIndicatorValue(indicator1, v).split(" ")[0]}
                      domain={normalize ? [0, 1] : ['auto', 'auto']}
                    />
                    
                    {indicator2 && indicator2 !== "none" && !normalize && (
                      <YAxis 
                        yAxisId="right" 
                        {...axisProps} 
                        orientation={isRtl ? "left" : "right"}
                        tickFormatter={v => formatIndicatorValue(indicator2, v).split(" ")[0]}
                        domain={['auto', 'auto']}
                      />
                    )}

                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Render Area series */}
                    {selectedRegions.map((region, rIdx) => {
                      if (hiddenSeries.has(region)) return null;
                      const color = getRegionColor(region, rIdx);
                      return (
                        <Area
                          key={`${region}_${indicator1}`}
                          type="monotone"
                          dataKey={normalize ? `${region}_${indicator1}_norm` : `${region}_${indicator1}`}
                          yAxisId="left"
                          stroke={color}
                          strokeWidth={2.5}
                          fill={`url(#grad_${region}_${indicator1})`}
                          isAnimationActive={!loading}
                          name={`${region} - ${getIndicatorName(indicator1, t)}`}
                        />
                      );
                    })}

                    {/* Secondary indicator lines */}
                    {indicator2 && indicator2 !== "none" && indicator1 !== indicator2 && selectedRegions.map((region, rIdx) => {
                      if (hiddenSeries.has(region)) return null;
                      const color = getRegionColor(region, rIdx);
                      return (
                        <Area
                          key={`${region}_${indicator2}`}
                          type="monotone"
                          dataKey={normalize ? `${region}_${indicator2}_norm` : `${region}_${indicator2}`}
                          yAxisId={normalize ? "left" : "right"}
                          stroke={color}
                          strokeDasharray="4 4"
                          strokeWidth={2}
                          fill="transparent"
                          isAnimationActive={!loading}
                          name={`${region} - ${getIndicatorName(indicator2, t)}`}
                        />
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : chartMode === "scatter" ? (
                indicator2 === "none" || indicator1 === indicator2 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/50 p-6 text-center">
                    <Info className="w-8 h-8 mb-2 text-primary opacity-60 animate-bounce" />
                    <p className="text-sm font-semibold">{t("viz_dual_vars_required")}</p>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      {t('viz_scatter_hint_detail')}
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                      
                      <XAxis 
                        type="number" 
                        dataKey="x" 
                        name={getIndicatorName(indicator1, t)}
                        tickFormatter={v => formatIndicatorValue(indicator1, v).split(" ")[0]}
                        {...axisProps}
                        domain={normalize ? [0, 1] : ['auto', 'auto']}
                      />
                      
                      <YAxis 
                        type="number" 
                        dataKey="y" 
                        name={getIndicatorName(indicator2, t)}
                        tickFormatter={v => formatIndicatorValue(indicator2, v).split(" ")[0]}
                        {...axisProps}
                        orientation={isRtl ? "right" : "left"}
                        domain={normalize ? [0, 1] : ['auto', 'auto']}
                      />

                      <Tooltip 
                        contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "11px" }}
                        formatter={(val: any, name: any, props: any) => {
                          const year = props.payload?.year;
                          if (name === "x") return [formatIndicatorValue(indicator1, val), `Year ${year} - ${getIndicatorName(indicator1, t)}`];
                          if (name === "y") return [formatIndicatorValue(indicator2, val), `Year ${year} - ${getIndicatorName(indicator2, t)}`];
                          return [val, name];
                        }}
                      />
                      
                      {selectedRegions.map((region, rIdx) => {
                        if (hiddenSeries.has(region)) return null;
                        const color = getRegionColor(region, rIdx);
                        
                        const scatData = chartData.map(pt => ({
                          year: pt.year,
                          x: normalize ? pt[`${region}_${indicator1}_norm`] : pt[`${region}_${indicator1}`],
                          y: normalize ? pt[`${region}_${indicator2}_norm`] : pt[`${region}_${indicator2}`]
                        })).filter(pt => pt.x !== undefined && pt.y !== undefined);

                        return (
                          <Scatter
                            key={region}
                            name={region}
                            data={scatData}
                            fill={color}
                            line={{ stroke: color, strokeWidth: 1.5, strokeDasharray: "3 3" }}
                            lineJointType="monotone"
                          />
                        );
                      })}
                    </ComposedChart>
                  </ResponsiveContainer>
                )
              ) : (
                /* Sleek Heatmap (Grid) Component */
                <div className="w-full h-full flex flex-col justify-between text-start text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-border/30">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {t('viz_heatmap_title')} {getIndicatorName(indicator1, t)}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] font-semibold">
                      <span>{t("viz_low")}</span>
                      <div className="w-24 h-2.5 rounded-full bg-gradient-to-r from-[hsl(180,60%,90%)] dark:from-[hsl(180,50%,25%)] to-[hsl(220,80%,30%)] dark:to-[hsl(220,85%,15%)] border border-border/40" />
                      <span>{t("viz_high")}</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto mt-3 border border-border/20 rounded-xl bg-slate-50/40 dark:bg-slate-950/20 p-4 space-y-4">
                    {selectedRegions.map((region, rIdx) => {
                      if (hiddenSeries.has(region)) return null;
                      return (
                        <div key={region} className="flex flex-col sm:flex-row sm:items-center gap-2">
                          {/* Label row */}
                          <div className="w-24 flex-shrink-0 font-bold text-slate-700 dark:text-slate-200 truncate">
                            {region}
                          </div>
                          
                          {/* Cells */}
                          <div className="flex-1 grid grid-cols-6 sm:grid-cols-12 md:grid-cols-14 gap-1.5">
                            {chartData.filter((_, idx) => idx % Math.max(1, Math.floor(chartData.length / 14)) === 0).map(pt => {
                              const val = pt[`${region}_${indicator1}`];
                              const normVal = pt[`${region}_${indicator1}_norm`] || 0;
                              const cellBg = getHeatmapColor(normVal, document.documentElement.classList.contains("dark"));
                              return (
                                <div
                                  key={pt.year}
                                  style={{ backgroundColor: cellBg }}
                                  title={`${region} (${pt.year}): ${formatIndicatorValue(indicator1, val || 0)}`}
                                  className="aspect-square flex items-center justify-center rounded border border-white/10 shadow-sm cursor-pointer hover:scale-110 transition-transform relative group"
                                >
                                  {/* Glassy Popover on Hover */}
                                  <span className="text-[9px] font-black text-slate-800 dark:text-slate-100 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">
                                    {pt.year.toString().slice(-2)}
                                  </span>
                                  
                                  {/* Floating micro tooltip */}
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[8px] rounded px-1.5 py-0.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1 z-30 font-bold">
                                    {pt.year}: {formatIndicatorValue(indicator1, val || 0)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="pt-2 text-[9px] text-muted-foreground text-center">
                    {t('viz_grid_note')}
                  </div>
                </div>
              )}
            </CardContent>

            {/* Interactive Legend overlay */}
            <div className="px-4 pb-4 flex flex-wrap gap-2 items-center justify-center border-t border-border/20 pt-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("viz_toggles")}</span>
              {selectedRegions.map((region, rIdx) => {
                const color = getRegionColor(region, rIdx);
                const hidden = hiddenSeries.has(region);
                return (
                  <button
                    key={region}
                    onClick={() => toggleSeries(region)}
                    style={{ 
                      borderColor: hidden ? "transparent" : `${color}33`,
                      background: hidden ? "transparent" : `${color}0b`
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all ${
                      hidden 
                        ? "text-muted-foreground line-through opacity-50 bg-slate-100 dark:bg-slate-800/40" 
                        : "text-foreground"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hidden ? "#94a3b8" : color }} />
                    {region}
                  </button>
                );
              })}
            </div>

          </Card>

          {/* Bento Grid Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Pearson r Card */}
            <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl overflow-hidden text-start hover:scale-[1.01] transition-transform duration-300">
              <CardHeader className="p-4 pb-1">
                <CardDescription className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider flex items-center gap-1">
                  {t('viz_pearson_title')}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-muted-foreground opacity-60 cursor-pointer" />
                    </PopoverTrigger>
                    <PopoverContent className="p-3 text-[11px] max-w-xs text-slate-700 dark:text-slate-300 space-y-1.5 bg-white dark:bg-slate-900 border-border">
                      <p className="font-bold">{t("viz_linear_scale")}</p>
                      <p>• {t('viz_pearson_scale_strong_pos')}</p>
                      <p>• {t('viz_pearson_scale_strong_neg')}</p>
                      <p>• {t('viz_pearson_scale_weak')}</p>
                    </PopoverContent>
                  </Popover>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 flex flex-col justify-between h-[100px]">
                {pearsonResult ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black tracking-tight text-foreground">
                        {pearsonResult.r}
                      </span>
                      <Badge 
                        variant={pearsonResult.variant} 
                        className={`text-[9px] font-extrabold tracking-wide uppercase px-2 py-0.5 rounded-full ${
                          pearsonResult.variant === "default" 
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                            : pearsonResult.variant === "destructive"
                            ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                            : "bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {pearsonResult.label === t("viz_strong_positive") && t("viz_strong_positive")}
                        {pearsonResult.label === t("viz_strong_negative") && t("viz_strong_negative")}
                        {pearsonResult.label === t("viz_moderate") && t("viz_moderate")}
                        {pearsonResult.label === t("viz_weak_no_corr") && t("viz_weak_no_corr")}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      {t('viz_pearson_corr_desc')}
                    </p>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-muted-foreground text-[11px] font-semibold border border-dashed border-border/40 rounded-xl">
                    {t('viz_select_secondary_hint')}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Growth Leader Card */}
            <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl overflow-hidden text-start hover:scale-[1.01] transition-transform duration-300">
              <CardHeader className="p-4 pb-1">
                <CardDescription className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider flex items-center gap-1">
                  {t('viz_growth_leader_title')}
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 flex flex-col justify-between h-[100px]">
                {growthLeader ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-foreground truncate max-w-[140px]">
                        {growthLeader.region}
                      </span>
                      <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        +{growthLeader.value}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      {t('viz_growth_leader_desc', { indicator: getIndicatorName(indicator1, t) })}
                    </p>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-muted-foreground text-[11px] font-semibold border border-dashed border-border/40 rounded-xl">
                    {t('viz_insufficient_data_points')}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Volatility Index Card */}
            <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl overflow-hidden text-start hover:scale-[1.01] transition-transform duration-300">
              <CardHeader className="p-4 pb-1">
                <CardDescription className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider flex items-center gap-1">
                  {t('viz_volatility_title')}
                  <Activity className="w-3.5 h-3.5 text-amber-500" />
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 flex flex-col justify-between h-[100px]">
                {volatilityIndex ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-foreground truncate max-w-[140px]">
                        {volatilityIndex.region}
                      </span>
                      <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        {volatilityIndex.value}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      {t('viz_volatility_desc_detail', { indicator: getIndicatorName(indicator1, t) })}
                    </p>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-muted-foreground text-[11px] font-semibold border border-dashed border-border/40 rounded-xl">
                    {t('viz_requires_years')}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

        </div>

      </div>

    </div>
  );
};

export default Visualization;
