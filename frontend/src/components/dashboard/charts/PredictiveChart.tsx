import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

interface PredictiveChartProps {
  data?: any[];
}

const PredictiveChart = ({ data }: PredictiveChartProps) => {
  const { t, isRtl } = useLanguage();
  // Fallback data if none provided (or empty)
  // Use provided data or empty array to avoid confusing static fallback
  const chartData = data || [];

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>{t('population_forecast')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" reversed={isRtl} />
            <YAxis stroke="hsl(var(--muted-foreground))" orientation={isRtl ? 'right' : 'left'} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                textAlign: isRtl ? 'right' : 'left'
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              name={`${t('historical_population_data')} (M)`}
              dot={{ fill: "hsl(var(--chart-1))" }}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="hsl(var(--chart-5))"
              strokeWidth={2}
              strokeDasharray="5 5"
              name={`${t('predictive_analytics')} (M)`}
              dot={{ fill: "hsl(var(--chart-5))" }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 p-4 bg-muted rounded-lg text-start">
          <p className="text-sm text-muted-foreground">
            <strong>{t('model_label')}:</strong> {t('linear_regression')} | <strong>{t('confidence_label')}:</strong> 90%
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PredictiveChart;
