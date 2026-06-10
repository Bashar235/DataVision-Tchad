import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";

interface PopulationChartProps {
  data?: any[];
}

const PopulationChart = ({ data }: PopulationChartProps) => {
  const { t, isRtl } = useLanguage();

  // Fallback data if none provided
  const chartData = data && data.length > 0 ? data : [
    { year: 2015, population: 13.2 },
    { year: 2020, population: 16.2 },
    { year: 2025, population: 19.5 },
    { year: 2030, population: 23.1 },
    { year: 2035, population: 27.2 },
    { year: 2040, population: 31.8 },
  ];

  const formatYAxis = (value: number) => {
    return `${value}${t('unit_millions_abbr')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card className="shadow-xl border-indigo-100/50 dark:border-indigo-900/20 backdrop-blur-sm bg-white/80 dark:bg-slate-950/80 overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
        <CardHeader className="text-start pb-2">
          <CardTitle className="text-xl font-bold text-indigo-950 dark:text-indigo-50">
            {t('population_growth_trend')}
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            {t('historical_and_projected')} (2009 — 2050)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                <XAxis
                  dataKey="year"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  reversed={isRtl}
                  minTickGap={30}
                  tick={{ fill: '#64748b' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatYAxis}
                  orientation={isRtl ? 'right' : 'left'}
                  tick={{ fill: '#64748b' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    textAlign: isRtl ? 'right' : 'left',
                    padding: '12px'
                  }}
                  itemStyle={{ fontWeight: 600, color: '#4f46e5' }}
                  labelStyle={{ marginBottom: '4px', fontWeight: 700, color: '#1e293b' }}
                  formatter={(value: number) => [`${value.toLocaleString()} ${t('unit_millions_abbr')}`, t('population')]}
                />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="population"
                  stroke="#4f46e5"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorPop)"
                  name={t('total_population')}
                  isAnimationActive={true}
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PopulationChart;
