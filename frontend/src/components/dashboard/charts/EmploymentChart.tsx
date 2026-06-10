import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";

interface EmploymentChartProps {
  data?: any[];
}

const EmploymentChart = ({ data }: EmploymentChartProps) => {
  const { t, isRtl } = useLanguage();

  // Fallback or transform data
  const chartData = data && data.length > 0 ? data : [
    { year: 2019, agriculture: 75, services: 15, industry: 10 },
    { year: 2021, agriculture: 73, services: 17, industry: 10 },
    { year: 2023, agriculture: 70, services: 18, industry: 12 },
    { year: 2025, agriculture: 68, services: 19, industry: 13 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="shadow-xl border-emerald-100/50 dark:border-emerald-900/20 backdrop-blur-sm bg-white/80 dark:bg-slate-950/80 overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
        <CardHeader className="text-start pb-2">
          <CardTitle className="text-xl font-bold text-emerald-950 dark:text-emerald-50">
            {t('employment_distribution')}
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            {t('sector_distribution_over_time')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }} barGap={0}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                <XAxis
                  dataKey="year"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  reversed={isRtl}
                  tick={{ fill: '#64748b' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}${t('unit_percent')}`}
                  orientation={isRtl ? 'right' : 'left'}
                  tick={{ fill: '#64748b' }}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    textAlign: isRtl ? 'right' : 'left',
                    padding: '12px'
                  }}
                  itemStyle={{ padding: '2px 0' }}
                  labelStyle={{ marginBottom: '8px', fontWeight: 700, color: '#1e293b' }}
                  formatter={(value: number, name: string) => [`${value}${t('unit_percent')}`, name]}
                />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }}
                />
                <Bar
                  dataKey="agriculture"
                  name={t('agriculture')}
                  stackId="a"
                  fill="#10b981"
                  radius={[0, 0, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={1500}
                />
                <Bar
                  dataKey="services"
                  name={t('services')}
                  stackId="a"
                  fill="#3b82f6"
                  radius={[0, 0, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={1500}
                  animationDelay={200}
                />
                <Bar
                  dataKey="industry"
                  name={t('industry')}
                  stackId="a"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={1500}
                  animationDelay={400}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default EmploymentChart;
