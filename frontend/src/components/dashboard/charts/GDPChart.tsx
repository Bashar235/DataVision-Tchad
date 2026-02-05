import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

interface GDPChartProps {
  data?: any[];
}

const GDPChart = ({ data }: GDPChartProps) => {
  const { t, isRtl } = useLanguage();

  const chartData = data && data.length > 0 ? data : [
    { year: 2019, gdp: 10.7 },
    { year: 2020, gdp: 10.9 },
    { year: 2021, gdp: 11.3 },
    { year: 2022, gdp: 11.6 },
    { year: 2023, gdp: 12.1 },
  ];

  const formatCurrency = (value: number) => {
    return `$${value}B`;
  };

  return (
    <Card className="shadow-lg border-slate-200 dark:border-slate-800">
      <CardHeader className="text-start">
        <CardTitle className="text-xl text-slate-900 dark:text-slate-50">{t('gdp_growth_billions')}</CardTitle>
        <CardDescription>{t('economic_output_trend')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorGdp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
              tickFormatter={formatCurrency}
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
              formatter={(value: number) => [`$${value} Billion`, t('gdp')]}
            />
            <Area
              type="monotone"
              dataKey="gdp"
              stroke="#8b5cf6"
              strokeWidth={3}
              fillOpacity={0.6}
              fill="url(#colorGdp)"
              name={t('gdp_billions')}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default GDPChart;
