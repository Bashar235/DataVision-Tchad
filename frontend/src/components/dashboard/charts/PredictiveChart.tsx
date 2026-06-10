import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { Layers, CheckCircle2 } from "lucide-react";

interface PredictiveChartProps {
  data?: any[];
  baselineName?: string;
  forecastName?: string;
  confidence?: string;
  showProphet?: boolean;
  modelType?: "ensemble" | "prophet" | "baseline";
}

// Demographic term definitions for tooltip
const getTooltipDefinition = (key: string, t: any) => {
  if (key.includes('actual') || key.includes('original')) return t('researcher_original_trend');
  if (key.includes('official_ref')) return t('chart_reference_baseline', {}, 'Reference Baseline (Official)');
  if (key.includes('forecast') || key.includes('scenario')) return t('researcher_projected_scenario');
  if (key.includes('ci_band')) return t('chart_confidence_interval');
  if (key.includes('prophet')) return t('chart_historical_reference');
  return key;
};

// Custom tooltip formatter
const CustomTooltip = ({ active, payload, label }: any) => {
  const { t } = useLanguage();
  if (!active || !payload?.length) return null;
  
  // Calculate simple growth if multiple points exist (heuristic)
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-3 text-xs shadow-2xl space-y-2 min-w-[200px]">
      <div className="flex justify-between items-center border-b border-border/50 pb-2 mb-1">
        <p className="font-bold text-foreground text-sm">{t('chart_year_label')} {label}</p>
        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
          {Number(label) >= 2025 ? t('chart_projection_label', {}, 'PROJECTION') : t('actual_data', {}, 'ACTUAL')}
        </span>
      </div>
      
      <div className="space-y-1.5">
        {payload.map((entry: any, i: number) => {
          if (!entry || entry.value == null) return null;
          // Skip the ci_band array entries rendered as Area
          if (Array.isArray(entry.value)) return null;
          
          const displayName = getTooltipDefinition(entry.dataKey, t) || entry.name;
          const isForecast = entry.dataKey === 'forecast';
          
          return (
            <div key={i} className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground font-medium">{displayName}</span>
              </div>
              <span className="font-mono font-bold text-foreground">
                {typeof entry.value === "number" ? entry.value.toFixed(2) : "—"}
                <span className="text-[10px] ml-1 font-normal text-muted-foreground">{t('unit_millions_abbr')}</span>
              </span>
            </div>
          );
        })}
      </div>

      {Number(label) > 2025 && (
        <div className="pt-2 border-t border-border/50 mt-1">
          <p className="text-[10px] text-primary font-bold flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-primary" />
            {t('financial_summary', {}, 'FINANCIAL SUMMARY')}
          </p>
          <p className="text-[10px] text-muted-foreground italic mt-0.5">
            {t('forecast_confidence_note', {}, 'Projected based on AI Ensemble Architecture')}
          </p>
        </div>
      )}
    </div>
  );
};

const PredictiveChart = ({
  data,
  baselineName,
  forecastName,
  confidence,
  showProphet = true,
  modelType = "ensemble",
}: PredictiveChartProps) => {
  const { t, isRtl } = useLanguage();
  const chartData = data || [];
  
  const bName = baselineName || t('predictive_trend_profile');
  const fName = forecastName || t('label_ai_forecast');

  const isHighConf = confidence?.includes("High") || confidence?.includes("🟢");

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={450}>
        <ComposedChart data={chartData} margin={{ top: 10, right: isRtl ? 0 : 20, left: isRtl ? 20 : 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ciBandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={modelType === "prophet" ? "#a855f7" : "#3b82f6"} stopOpacity={0.2} />
              <stop offset="95%" stopColor={modelType === "prophet" ? "#a855f7" : "#3b82f6"} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={modelType === "prophet" ? "#a855f7" : "#3b82f6"} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={modelType === "prophet" ? "#a855f7" : "#3b82f6"} stopOpacity={0}/>
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} strokeOpacity={0.4} />

          <XAxis
            dataKey="year"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 10, fontWeight: 500 }}
            reversed={isRtl}
            tickLine={false}
            axisLine={false}
            padding={{ left: 30, right: 30 }}
            interval={4}
            minTickGap={30}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 10, fontWeight: 500 }}
            orientation={isRtl ? "right" : "left"}
            tickFormatter={(v) => `${v}${t('unit_millions_abbr')}`}
            tickLine={false}
            axisLine={false}
            width={45}
          />

          {chartData.length === 0 || chartData.every(d => !d.actual && !d.forecast) ? (
            <Tooltip 
              content={({ active }: any) => {
                if (!active) return null;
                return (
                  <div className="bg-background/80 backdrop-blur-md border border-dashed border-primary/30 rounded-2xl p-8 text-center space-y-3 shadow-xl">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
                      <Layers className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{t('data_collection_in_progress')}</h3>
                    <p className="text-[10px] text-muted-foreground max-w-[200px] mx-auto leading-relaxed">
                      {t('high_variance_warning')}
                    </p>
                  </div>
                );
              }}
              active={true}
              position={{ x: 150, y: 150 }}
            />
          ) : (
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }} />
          )}
          <Legend
            iconType="circle"
            iconSize={6}
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: "10px", paddingBottom: "20px", fontWeight: 600 }}
          />

          {/* 1. 95% CI Shaded Area (Projection only) */}
          <Area
            type="monotone"
            dataKey="ci_band"
            stroke="none"
            fill="url(#ciBandGrad)"
            fillOpacity={1}
            name={t('chart_confidence_interval')}
            legendType="none"
            activeDot={false}
            isAnimationActive={true}
          />

          {/* 2. Prophet reference line — Slate Grey Dashed */}
          {showProphet && modelType === "ensemble" && (
            <Line
              type="monotone"
              dataKey="prophet_ref"
              stroke="#64748b" 
              strokeWidth={1.5}
              strokeDasharray="5 5"
              name={t('chart_historical_reference')}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          )}

          {/* 2.5 Official Reference Baseline — Dotted Grey */}
          <Line
            type="monotone"
            dataKey="official_ref"
            stroke="#94a3b8" 
            strokeWidth={2}
            strokeDasharray="4 4"
            name={t('chart_reference_baseline', {}, 'Reference Baseline (Official)')}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={true}
          />

          {/* 3. AI Projection Area */}
          {modelType !== "baseline" && (
            <Area
              type="monotone"
              dataKey="forecast"
              stroke={modelType === "prophet" ? "#a855f7" : "#3b82f6"} 
              strokeWidth={3}
              fill="url(#colorForecast)"
              name={forecastName || t('label_ai_forecast')}
              activeDot={{ r: 5, strokeWidth: 0 }}
              isAnimationActive={true}
            />
          )}

          {/* 4. Historical Actuals — Solid Black */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#000000" 
            strokeWidth={3}
            name={t('actual_data', undefined, 'Historique')}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0 }}
            isAnimationActive={true}
          />

          {/* Vertical separator: historical → projection */}
          <ReferenceLine
            x="2025"
            stroke="red"
            strokeDasharray="3 3"
            label={{ 
              value: "NOW", 
              position: "insideTopRight", 
              fontSize: 10, 
              fontWeight: 800,
              fill: "red",
              offset: 10
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Modern Footer bar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-primary/5 rounded-xl text-[10px] text-muted-foreground border border-primary/10 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-primary animate-pulse" style={{ color: modelType === "prophet" ? "#a855f7" : modelType === "baseline" ? "#94a3b8" : "#3b82f6" }} />
            <strong className="text-foreground uppercase tracking-wider">{t('chart_ai_architecture', {}, 'Model Architecture')}</strong> 
            <span className="font-medium antialiased">
              {modelType === "ensemble" 
                ? "XGBoost (60%) + LSTM (40%)" 
                : modelType === "prophet" 
                ? "Facebook Prophet (Additive)" 
                : "Official Reference Baseline"}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-primary" style={{ color: modelType === "prophet" ? "#a855f7" : modelType === "baseline" ? "#94a3b8" : "#3b82f6" }} />
            <strong className="text-foreground uppercase tracking-wider">{t('chart_ci_label', {}, 'Confidence')}</strong> 
            <span className="font-medium antialiased">
              {modelType === "baseline" ? "Guaranteed Baseline" : "95% Confidence Intervals"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border ${isHighConf ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
            {modelType === "baseline" ? "Guaranteed" : (confidence || t('chart_pending'))}
          </span>
        </div>
      </div>
    </div>

  );
};

export default PredictiveChart;
