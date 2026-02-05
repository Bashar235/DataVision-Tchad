import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

interface EmploymentChartProps {
  data?: any[];
}

const EmploymentChart = ({ data }: EmploymentChartProps) => {
  const { t, isRtl } = useLanguage();

  // Fallback or transform data
  const chartData = data && data.length > 0 ? data : [
    { year: 2019, agriculture: 75, services: 15, industry: 10 },
    { year: 2020, agriculture: 74, services: 16, industry: 10 },
    { year: 2021, agriculture: 73, services: 17, industry: 10 },
    { year: 2022, agriculture: 72, services: 17, industry: 11 },
    { year: 2023, agriculture: 70, services: 18, industry: 12 },
  ];

  return (
    <Card className="shadow-lg border-emerald-100 dark:border-emerald-900/20">
      <CardHeader className="text-start">
        <CardTitle className="text-xl text-emerald-950 dark:text-emerald-50">{t('employment_trends')}</CardTitle>
        <CardDescription>{t('sector_distribution_over_time')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
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
              tickFormatter={(value) => `${value}%`}
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
              formatter={(value: number) => [`${value}%`]}
            />
            <Legend iconType="circle" />
            <Bar
              dataKey="agriculture"
              name={t('agriculture')}
              barSize={20}
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
            />
            <Bar
              dataKey="services"
              name={t('services')}
              barSize={20}
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
            />
            <Line
              type="monotone"
              dataKey="industry"
              name={t('industry')}
              stroke="#f59e0b"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              isAnimationActive={true}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default EmploymentChart;
