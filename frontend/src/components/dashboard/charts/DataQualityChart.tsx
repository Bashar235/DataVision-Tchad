import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

interface DataQualityChartProps {
    data?: any[];
}

const DataQualityChart = ({ data }: DataQualityChartProps) => {
    const { t, isRtl } = useLanguage();

    // Fallback data
    const chartData = data && data.length > 0 ? data : [
        { region: "N'Djamena", completeness: 98, accuracy: 95 },
        { region: "Logone Occ.", completeness: 92, accuracy: 88 },
        { region: "Mayo-Kebbi", completeness: 85, accuracy: 82 },
        { region: "Salamat", completeness: 78, accuracy: 75 },
        { region: "Tibesti", completeness: 72, accuracy: 70 },
    ];

    return (
        <Card className="shadow-sm border-amber-100 dark:border-amber-900/20">
            <CardHeader className="text-start">
                <CardTitle className="text-lg text-amber-950 dark:text-amber-50">{t('data_quality_metrics')}</CardTitle>
                <CardDescription>{t('completeness_and_accuracy_by_region')}</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis
                            dataKey="region"
                            type="category"
                            width={100}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            reversed={isRtl}
                            orientation={isRtl ? 'right' : 'left'}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{
                                backgroundColor: "rgba(255, 255, 255, 0.95)",
                                border: "none",
                                borderRadius: "8px",
                                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                textAlign: isRtl ? 'right' : 'left'
                            }}
                        />
                        <Legend iconType="circle" />
                        <Bar dataKey="completeness" name={t('database_completeness')} fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={10} isAnimationActive={true} />
                        <Bar dataKey="accuracy" name={t('analytics_accuracy')} fill="#10b981" radius={[0, 4, 4, 0]} barSize={10} isAnimationActive={true} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export default DataQualityChart;
