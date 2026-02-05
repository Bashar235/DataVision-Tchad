import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { RefreshCw } from "lucide-react";

interface AgeDistributionChartProps {
  data?: {
    age014: number;
    age1564: number;
    age65plus: number;
  };
}

const AgeDistributionChart = ({ data: inputData }: AgeDistributionChartProps) => {
  const { t, isRtl } = useLanguage();
  const data = inputData ? [
    { name: t('age_group_0_14'), value: inputData.age014 },
    { name: t('age_group_15_64'), value: inputData.age1564 },
    { name: t('age_group_65_plus'), value: inputData.age65plus },
  ] : [
    { name: t('age_group_0_14'), value: 0 },
    { name: t('age_group_15_64'), value: 0 },
    { name: t('age_group_65_plus'), value: 0 },
  ];

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
  ];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="text-start">
        <CardTitle className="text-lg">{t('age_distribution')}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center min-h-[200px]">
        {(!inputData || (inputData.age014 === 0 && inputData.age1564 === 0 && inputData.age65plus === 0)) ? (
          <div className="flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 text-primary animate-spin opacity-40" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              {t('data_initializing') || "Data Initializing..."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "none",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  textAlign: isRtl ? 'right' : 'left'
                }}
                formatter={(value: number, name: string) => [`${value}%`, name]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                formatter={(value) => <span className={`text-sm text-slate-600 dark:text-slate-400 ${isRtl ? 'mr-1' : 'ml-1'}`}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default AgeDistributionChart;
