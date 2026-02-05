import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

interface SystemHealthChartProps {
    data?: any[];
}

const SystemHealthChart = ({ data }: SystemHealthChartProps) => {
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

    return (
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="text-start">
                <CardTitle className="text-lg text-slate-900 dark:text-slate-50">{t('stat_system_health_label')}</CardTitle>
                <CardDescription>{t('system_integrity')}</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                            dataKey="time"
                            stroke="#64748b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            reversed={isRtl}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#64748b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            orientation={isRtl ? 'right' : 'left'}
                            label={{ value: 'ms', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#94a3b8', fontSize: 10 } }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation={isRtl ? 'left' : 'right'}
                            stroke="#ef4444"
                            fontSize={12}
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
                                textAlign: isRtl ? 'right' : 'left'
                            }}
                        />
                        <Legend iconType="circle" />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="response_time"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            name={t('response_time_ms')}
                            dot={false}
                            activeDot={{ r: 6 }}
                            isAnimationActive={true}
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="error_rate"
                            stroke="#ef4444"
                            strokeWidth={2}
                            name={t('error_rate_percent')}
                            dot={false}
                            isAnimationActive={true}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export default SystemHealthChart;
