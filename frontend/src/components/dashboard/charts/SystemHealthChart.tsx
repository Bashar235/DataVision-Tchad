import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

interface SystemHealthChartProps {
    data?: any[];
    height?: number;
    showCard?: boolean;
}

const SystemHealthChart = ({ data, height = 200, showCard = false }: SystemHealthChartProps) => {
    const { t, isRtl } = useLanguage();

    // Fallback data
    const chartData = data && data.length > 0 ? data : [
        { time: "08:00", response_time: 45, error_rate: 0.1 },
        { time: "10:00", response_time: 120, error_rate: 0.5 },
        { time: "12:00", response_time: 85, error_rate: 0.2 },
        { time: "14:00", response_time: 60, error_rate: 0.1 },
        { time: "16:00", response_time: 150, error_rate: 0.8 },
        { time: "18:00", response_time: 55, error_rate: 0.1 },
    ];

    const chartContent = (
        <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    reversed={isRtl}
                />
                <YAxis
                    yAxisId="left"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    orientation={isRtl ? 'right' : 'left'}
                />
                <YAxis
                    yAxisId="right"
                    orientation={isRtl ? 'left' : 'right'}
                    stroke="#ef4444"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        border: "none",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        fontSize: '11px',
                        textAlign: isRtl ? 'right' : 'left'
                    }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="response_time"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name={t('response_time_ms')}
                    dot={false}
                    activeDot={{ r: 4 }}
                />
                <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="error_rate"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name={t('error_rate_percent')}
                    dot={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );

    if (!showCard) return chartContent;

    return (
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="text-start pb-2">
                <CardTitle className="text-base text-slate-900 dark:text-slate-50">{t('stat_system_health_label')}</CardTitle>
                <CardDescription className="text-xs">{t('system_integrity')}</CardDescription>
            </CardHeader>
            <CardContent>
                {chartContent}
            </CardContent>
        </Card>
    );
};

export default SystemHealthChart;

