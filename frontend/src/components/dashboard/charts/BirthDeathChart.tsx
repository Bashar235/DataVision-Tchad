import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

interface BirthDeathChartProps {
    data?: any[];
}

const BirthDeathChart = ({ data }: BirthDeathChartProps) => {
    const { t, isRtl } = useLanguage();

    // Fallback data
    const chartData = data && data.length > 0 ? data : [
        { year: 2015, birth_rate: 42, death_rate: 12 },
        { year: 2017, birth_rate: 41, death_rate: 11 },
        { year: 2019, birth_rate: 40, death_rate: 11 },
        { year: 2021, birth_rate: 39, death_rate: 10 },
        { year: 2023, birth_rate: 38, death_rate: 10 },
    ];

    return (
        <Card className="shadow-lg border-rose-100 dark:border-rose-900/20">
            <CardHeader className="text-start">
                <CardTitle className="text-xl text-rose-950 dark:text-rose-50">{t('birth_vs_death_rate')}</CardTitle>
                <CardDescription>{t('demographic_transition_metrics')}</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
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
                            orientation={isRtl ? 'right' : 'left'}
                            label={{ value: t('per_1000_people'), angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#94a3b8', fontSize: 12 } }}
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
                        <Area
                            type="monotone"
                            dataKey="birth_rate"
                            stroke="none"
                            fill="url(#colorRate)"
                            fillOpacity={1}
                            name={t('natural_increase_potential')}
                        />
                        <Line
                            type="monotone"
                            dataKey="birth_rate"
                            stroke="#10b981"
                            strokeWidth={3}
                            name={t('birth_rate')}
                            isAnimationActive={true}
                            dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                        />
                        <Line
                            type="monotone"
                            dataKey="death_rate"
                            stroke="#f43f5e"
                            strokeWidth={3}
                            name={t('death_rate')}
                            isAnimationActive={true}
                            dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export default BirthDeathChart;
