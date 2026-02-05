import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

interface PopulationChartProps {
  data?: any[];
}

const PopulationChart = ({ data }: PopulationChartProps) => {
  const { t, isRtl } = useLanguage();

  // Fallback data if none provided
  const chartData = data && data.length > 0 ? data : [
    { year: 2015, population: 13.2 },
    { year: 2017, population: 14.0 },
    { year: 2019, population: 14.9 },
    { year: 2021, population: 15.8 },
    { year: 2023, population: 16.8 },
  ];

  const formatYAxis = (value: number) => {
    return `${value}M`;
  };

  return (
    <Card className="shadow-lg border-indigo-100 dark:border-indigo-900/20">
      <CardHeader className="text-start">
        <CardTitle className="text-xl text-indigo-950 dark:text-indigo-50">{t('pop_growth_trend')}</CardTitle>
        <CardDescription>{t('historical_and_projected')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="year"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              reversed={isRtl}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
              orientation={isRtl ? 'right' : 'left'}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "none",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                textAlign: isRtl ? 'right' : 'left'
              }}
              formatter={(value: number) => [`${value}M`, t('population')]}
              labelStyle={{ color: "#334155", fontWeight: 600 }}
            />
            <Legend iconType="circle" />
            <Area
              type="monotone"
              dataKey="population"
              stroke="#4f46e5"
              strokeWidth={3}
              fillOpacity={0.6}
              fill="url(#colorPop)"
              name={t('pop_m')}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default PopulationChart;
