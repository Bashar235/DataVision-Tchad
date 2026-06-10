import { useState, useEffect, useCallback, useRef } from "react";
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
import { Button } from "@/components/ui/button";
import api, {
  getSpatialMeta,
  getAnalyticsTimeseries
} from "@/services/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, RefreshCcw, Camera } from "lucide-react";
import html2canvas from "html2canvas";
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

// ─── Chart colour palette & config ───────────────────────────────────────────
const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
];

const AGE_GROUPS = [
  { label: "0–14 ans",  inseedName: "Part 0-14 ans" },
  { label: "15–64 ans", inseedName: "Part 15-64 ans" },
  { label: "65+ ans",   inseedName: "Part 65+ ans" },
];

const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
  fontSize: "12px",
  color: "#334155"
};

// ─── Shared Card Wrapper ──────────────────────────────────────────────────────
const ChartCard = ({ title, description, loading, empty, children, accentClass, onExport, exportLabel }: any) => {
  const { t } = useLanguage();
  return (
    <Card className={`shadow-sm border-t-4 transition-all duration-300 bg-background ${accentClass}`}>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
        <div className="flex flex-row items-center gap-3">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />}
          {onExport && (
            <button
              onClick={onExport}
              title={exportLabel}
              className="p-1.5 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 h-[450px]">
        {empty && !loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/5 rounded-2xl border border-dashed border-border/50 space-y-3">
            <div className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center">
              <RefreshCcw className="w-5 h-5 text-muted-foreground/50 animate-spin-slow" />
            </div>
            <p className="text-sm font-semibold text-foreground/70">{t('data_collection_in_progress')}</p>
            <p className="text-[10px] text-muted-foreground px-8 text-center">{t('high_variance_warning')}</p>
          </div>
        ) : (
          <div className={`w-full h-full transition-opacity duration-300 ${loading ? "opacity-40" : "opacity-100"}`}>
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const GOLD_DATASET_ID = "35949ad2-8b2e-5123-bd6a-2dd65a98a9d3";

const Visualizations = () => {
  const { t, isRtl } = useLanguage();
  
  // filters
  const [indicator, setIndicator]     = useState("population");
  const [region, setRegion]           = useState("Tchad");
  const [year, setYear]               = useState("2025");
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  // chart data states
  const [popData,        setPopData]        = useState<any[]>([]);
  const [gdpData,        setGdpData]        = useState<any[]>([]);
  const [urbanData,      setUrbanData]      = useState<any[]>([]);
  const [fertilityData,  setFertilityData]  = useState<any[]>([]);
  const [ageData,        setAgeData]        = useState<any[]>([]);
  const [literacyData,   setLiteracyData]   = useState<any[]>([]);
  const [waterData,      setWaterData]      = useState<any[]>([]);
  const [infantMortData, setInfantMortData] = useState<any[]>([]);

  const [loading,        setLoading]        = useState(false);
  const [metaLoading,    setMetaLoading]    = useState(true);

  // Reference for html2canvas snapshot
  const chartRef = useRef<HTMLDivElement>(null);

  // ── Load region list on mount ────────────────────────────────────────────
  useEffect(() => {
    getSpatialMeta()
      .then(meta => {
        if (meta?.regions?.length) setAvailableRegions(meta.regions);
      })
      .catch(() => setAvailableRegions([]))
      .finally(() => setMetaLoading(false));
  }, []);

  // ── Fetch all indicator data when region or year changes ─────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const yr = Number(year);
      const startYr = 2009;

      const [pop, gdp, urban, fert, lit, water, infantM] = await Promise.allSettled([
        getAnalyticsTimeseries({ indicator: "Population Totale",              region, start_year: startYr, end_year: 2050, dataset_id: GOLD_DATASET_ID }),
        getAnalyticsTimeseries({ indicator: "PIB Nominal",                    region, start_year: startYr, end_year: 2050, dataset_id: GOLD_DATASET_ID }),
        getAnalyticsTimeseries({ indicator: "Taux d'Urbanisation",           region, start_year: startYr, end_year: 2050, dataset_id: GOLD_DATASET_ID }),
        getAnalyticsTimeseries({ indicator: "Indice Synthétique de Fécondité", region, start_year: startYr, end_year: 2050, dataset_id: GOLD_DATASET_ID }),
        getAnalyticsTimeseries({ indicator: "Taux d'alphabétisation",         region, start_year: startYr, end_year: 2050, dataset_id: GOLD_DATASET_ID }),
        getAnalyticsTimeseries({ indicator: "Accès à l'eau potable",          region, start_year: startYr, end_year: 2050, dataset_id: GOLD_DATASET_ID }),
        getAnalyticsTimeseries({ indicator: "Mortalité Infantile",            region, start_year: startYr, end_year: 2050, dataset_id: GOLD_DATASET_ID }),
      ]);

      if (pop.status === "fulfilled") {
        setPopData(pop.value
          .filter((d: any) => d.value > 0)
          .map((d: any) => ({ year: d.year, population: +(d.value / 1_000_000).toFixed(2) })));
      }
      if (gdp.status === "fulfilled") {
        setGdpData(gdp.value
          .filter((d: any) => d.value > 0)
          .map((d: any) => ({ year: d.year, gdp: +Number(d.value).toFixed(2) })));
      }
      if (urban.status === "fulfilled") {
        setUrbanData(urban.value
          .filter((d: any) => d.value > 0)
          .map((d: any) => ({ year: d.year, value: +Number(d.value).toFixed(1) })));
      }
      if (fert.status === "fulfilled") {
        setFertilityData(fert.value
          .filter((d: any) => d.value > 0)
          .map((d: any) => ({ year: d.year, value: +Number(d.value).toFixed(2) })));
      }
      if (lit.status === "fulfilled") {
        setLiteracyData(lit.value
          .filter((d: any) => d.value > 0)
          .map((d: any) => ({ year: d.year, value: +Number(d.value).toFixed(1) })));
      }
      if (water.status === "fulfilled") {
        setWaterData(water.value
          .filter((d: any) => d.value > 0)
          .map((d: any) => ({ year: d.year, value: +Number(d.value).toFixed(1) })));
      }
      if (infantM.status === "fulfilled") {
        setInfantMortData(infantM.value
          .filter((d: any) => d.value > 0)
          .map((d: any) => ({ year: d.year, value: +Number(d.value).toFixed(2) })));
      }

      try {
        const token = sessionStorage.getItem('authToken');
        const statsRes = await api.get(`/v1/spatial/stats/${encodeURIComponent(region)}?year=${yr}&dataset_id=${GOLD_DATASET_ID}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const ageStats = statsRes.data.age_stats || [];
        
        // Find 'Total' for percentage calculation
        const totalRow = ageStats.find((s: any) => s.age_group === "Total");
        const totalPop = totalRow ? totalRow.population : 0;

        const excluded = ["Total", "6-11 ans", "15-49 ans - Femmes", "Part 0-14 ans", "Part 15-64 ans", "Part 65+ ans"];
        
        const granular = ageStats
          .filter((s: any) => s.age_group && !excluded.includes(s.age_group))
          .map((s: any) => ({
            group: s.age_group,
            value: s.population,
            percentage: totalPop > 0 ? Number(((s.population / totalPop) * 100).toFixed(1)) : 0
          }));

        // Sorting
        const ageSort = (a: any, b: any) => {
          if (a.group === "80+") return 1;
          if (b.group === "80+") return -1;
          return parseInt(a.group) - parseInt(b.group);
        };
        
        setAgeData(granular.sort(ageSort));
      } catch (err) {
        console.error("Age stats fetch failed:", err);
        setAgeData([]);
      }

    } catch (err) {
      console.error("[Visualizations] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [region, year]);

  useEffect(() => {
    if (!metaLoading) fetchAll();
  }, [fetchAll, metaLoading]);

  // ── Snapshot Export ───────────────────────────────────────────────────────
  const handleExportSnapshot = async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      const cleanRegion = region.replace(/\s+/g, '_');
      link.download = `INSEED_Snapshot_${indicator}_${cleanRegion}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      // Record Activity
      import("@/services/api").then(api => {
        api.recordActivityEvent('report', { 
          action: 'SNAPSHOT_EXPORT', 
          details: { filename: `INSEED_Snapshot_${indicator}_${cleanRegion}.png`, indicator, region } 
        });
      });
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  // ── Axis helpers ──────────────────────────────────────────────────────────
  const axisProps: any = {
    stroke: "#64748b", fontSize: 10, tickLine: false, axisLine: false,
    reversed: isRtl,
    minTickGap: 30,
    interval: "preserveStartEnd",
  };

  // ── Render active chart based on indicator ────────────────────────────────
  const renderActiveChart = () => {
    const regionLabel = region === "Tchad" ? t('national_tchad') : region;

    if (indicator === "age") {
      const empty = ageData.length === 0;
      const getBarColor = (group: string) => {
        if (group.includes("65") || group.includes("70") || group.includes("75") || group === "80+") return "#6366f1";
        if (parseInt(group) < 15) return "#10b981";
        return "#3b82f6";
      };

      return (
        <ChartCard
          title={t('indicator_age_groups')}
          description={`${t('demographics_label')} — ${regionLabel} (${year})`}
          loading={loading}
          empty={empty}
          accentClass="border-purple-100 dark:border-purple-900/20"
          onExport={handleExportSnapshot}
          exportLabel={t('export_snapshot')}
        >
          <div className="flex flex-col h-full">
            <ResponsiveContainer width="100%" height="85%">
              <BarChart layout="vertical" data={ageData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.1} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="group" type="category" width={60} fontSize={10} 
                  tickLine={false} axisLine={false} orientation={isRtl ? "right" : "left"}
                  tick={{ fill: "#64748b" }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.02)" }}
                  contentStyle={tooltipStyle}
                  formatter={(value: any, _: any, props: any) => {
                    const fmtVal = value >= 1000000 
                      ? `${(value / 1_000_000).toFixed(2)}M` 
                      : value.toLocaleString();
                    return [
                      <div className="flex flex-col text-xs">
                        <span className="font-bold">{fmtVal}</span>
                      </div>,
                      ""
                    ];
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                  {ageData.map((entry, index) => (
                    <Cell key={index} fill={getBarColor(entry.group)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 pb-2 text-[10px] text-muted-foreground font-medium">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#10b981]" /> {t('youth', {}, 'Youth')}</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#3b82f6]" /> {t('working_age', {}, 'Working Age')}</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#6366f1]" /> {t('elderly', {}, 'Elderly')}</div>
            </div>
          </div>
        </ChartCard>
      );
    }

    if (indicator === "urbanisation") {
      const empty = urbanData.length === 0;
      return (
        <ChartCard
          title={t('indicator_urbanization')}
          description={`${t('indicator_urbanization')} 2009–2050 — ${regionLabel}`}
          loading={loading}
          empty={empty}
          accentClass="border-blue-100 dark:border-blue-900/20"
          onExport={handleExportSnapshot}
          exportLabel={t('export_snapshot')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={urbanData} margin={{ top: 5, right: 10, left: 0, bottom: 15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="year" {...axisProps} padding={{ left: 30, right: 30 }} />
              <YAxis {...axisProps} tickFormatter={v => `${v}%`} orientation={isRtl ? "right" : "left"} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`, t('indicator_urbanization')]} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('indicator_urbanization')} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    }

    // Default: Area charts
    let data: any[];
    let dataKey: string;
    let title: string;
    let desc: string;
    let color: string;
    let gradId: string;
    let tickFmt: (v: number) => string;

    switch (indicator) {
      case "gdp":
        data = gdpData; dataKey = "gdp"; title = t('gdp_billions');
        desc = `${t('economics')} — ${regionLabel}`; color = "#8b5cf6"; gradId = "gradGdp";
        tickFmt = (v) => `$${v}B`;
        break;
      case "fertility":
        data = fertilityData; dataKey = "value"; title = t('fertility_rate_evolution');
        desc = `${t('children_per_woman')} — ${regionLabel}`; color = "#f59e0b"; gradId = "gradFert";
        tickFmt = (v) => `${v}`;
        break;
      case "lifeexp":
        data = fertilityData; dataKey = "value"; title = t('indicator_life_expectancy');
        desc = `${t('indicator_life_expectancy')} — ${regionLabel}`; color = "#10b981"; gradId = "gradLife";
        tickFmt = (v) => `${v} ${t('unit_years')}`;
        break;
      case "literacy":
        data = literacyData; dataKey = "value"; title = t('indicator_literacy');
        desc = `${t('real_data')} — ${regionLabel}`; color = "#0284c7"; gradId = "gradLit";
        tickFmt = (v) => `${v}%`;
        break;
      case "water":
        data = waterData; dataKey = "value"; title = t('indicator_water_access');
        desc = `${t('real_data')} — ${regionLabel}`; color = "#0d9488"; gradId = "gradWater";
        tickFmt = (v) => `${v}%`;
        break;
      case "infant_mortality":
        data = infantMortData; dataKey = "value"; title = t('indicator_infant_mortality');
        desc = `${t('real_data')} — ${regionLabel}`; color = "#e11d48"; gradId = "gradInfant";
        tickFmt = (v) => `${v}`;
        break;
      default: // population
        data = popData; dataKey = "population"; title = t('total_population');
        desc = `${t('population_growth_trend')} — ${regionLabel}`; color = "#4f46e5"; gradId = "gradPop";
        tickFmt = (v) => `${v}M`;
    }

    const empty = data.length === 0;
    return (
      <ChartCard title={title} description={desc} loading={loading} empty={empty} onExport={handleExportSnapshot} exportLabel={t('export_snapshot')}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 15 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.75} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="year" {...axisProps} padding={{ left: 30, right: 30 }} />
            <YAxis {...axisProps} tickFormatter={tickFmt} orientation={isRtl ? "right" : "left"} />
            <Tooltip contentStyle={tooltipStyle}
              formatter={(v: any) => [tickFmt(v), title]}
              labelStyle={{ color: "#334155", fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradId})`}
              isAnimationActive
              animationDuration={700}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`max-w-[1000px] mx-auto space-y-6 mt-4 px-2 ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="text-start">
        <h1 className="text-xl font-bold text-foreground">{t('interactive_visualizations')}</h1>
        <p className="text-sm text-muted-foreground">{t('multi_view_sync')} · {region === "Tchad" ? t('national_tchad') : region}</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="p-4 pb-2 text-start">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {t('dynamic_indicator_selector')}
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Indicator */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">{t('indicator')}</label>
              <Select value={indicator} onValueChange={setIndicator}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="population">{t('total_population')}</SelectItem>
                  <SelectItem value="gdp">{t('gdp_billions')}</SelectItem>
                  <SelectItem value="urbanisation">{t('indicator_urbanization')}</SelectItem>
                  <SelectItem value="fertility">{t('fertility_rate_evolution')}</SelectItem>
                  <SelectItem value="lifeexp">{t('indicator_life_expectancy')}</SelectItem>
                  <SelectItem value="age">{t('indicator_age_groups')}</SelectItem>
                  <SelectItem value="literacy">{t('indicator_literacy')}</SelectItem>
                  <SelectItem value="water">{t('indicator_water_access')}</SelectItem>
                  <SelectItem value="infant_mortality">{t('indicator_infant_mortality')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Region */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">{t('region_selection')}</label>
              <Select value={region} onValueChange={setRegion} disabled={metaLoading}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tchad">{t('national_tchad')}</SelectItem>
                  {availableRegions.filter(r => r !== "Tchad").map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reset button */}
          {(region !== "Tchad" || indicator !== "population") && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => { setRegion("Tchad"); setIndicator("population"); setYear("2025"); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCcw className="w-3 h-3" />
                {t('reset_filters')}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart area — centered single card with ref for snapshot */}
      <div className="w-full" ref={chartRef}>
        {renderActiveChart()}
      </div>

      {/* Quick-info strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Source",        value: "INSEED — RGPH2" },
          { label: t('coverage', {}, 'Couverture'), value: "2009 – 2050" },
          { label: t('region_selection'), value: region === "Tchad" ? t('national_tchad') : region },
        ].map(({ label, value }) => (
          <div key={label} className="p-3 bg-muted/30 rounded-xl border border-border/40 text-start space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-xs font-medium text-foreground">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Visualizations;
