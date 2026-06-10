import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";

interface DataQualityChartProps {
    data?: any; // Expecting a score number or object
}

const DataQualityChart = ({ data }: DataQualityChartProps) => {
    const { t } = useLanguage();

    // The data passed from AnalystDashboard is the overall health score
    const score = typeof data === 'number' ? data : (data?.score || 98);
    
    // Gauge data
    const chartData = [
        { name: "Score", value: score, fill: score > 95 ? "#10b981" : score > 90 ? "#f59e0b" : "#ef4444" },
        { name: "Remaining", value: 100 - score, fill: "#e2e8f0" }
    ];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
        >
            <Card className="shadow-xl border-amber-100/50 dark:border-amber-900/20 backdrop-blur-sm bg-white/80 dark:bg-slate-950/80 overflow-hidden h-full">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                <CardHeader className="text-start pb-2">
                    <CardTitle className="text-xl font-bold text-amber-950 dark:text-amber-50">{t('data_quality_score')}</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">{t('health_score_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center pt-4">
                    <div className="h-[250px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    startAngle={210}
                                    endAngle={-30}
                                    innerRadius={80}
                                    outerRadius={100}
                                    paddingAngle={0}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                    <Label 
                                        value={`${score}%`} 
                                        position="center" 
                                        fill={score > 95 ? "#059669" : "#1e293b"}
                                        className="text-4xl font-extrabold"
                                    />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            score > 95 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                            {score > 95 ? t('database_reliable') : t('database_scan_needed')}
                        </span>
                        <p className="text-sm text-slate-500 mt-3 max-w-[200px] mx-auto">
                            {t('source_sync_active')}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default DataQualityChart;
