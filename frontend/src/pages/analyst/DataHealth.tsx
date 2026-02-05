import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { getHealthStats } from "@/services/api";
import { useEffect, useState } from "react";
import { Database, ShieldCheck, Zap, AlertTriangle, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import IntegrityGauge from "@/components/charts/IntegrityGauge";

const DataHealth = () => {
    const { t, isRtl } = useLanguage();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getHealthStats();
                setStats(data);
            } catch (error) {
                console.error("Failed to fetch health stats", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const impactData = [
        { name: 'Initial', errors: 100 },
        { name: 'Scan 1', errors: 65 },
        { name: 'Scan 2', errors: 30 },
        { name: 'Current', errors: stats?.score ? (100 - stats.score) : 15 },
    ];

    const errorBreakdown = [
        { name: 'Null Values', value: stats?.neutralized_errors ? Math.round(stats.neutralized_errors * 0.7) : 400, color: '#6366f1' },
        { name: 'Duplicates', value: stats?.neutralized_errors ? Math.round(stats.neutralized_errors * 0.3) : 150, color: '#10b981' },
    ];

    const mainPadding = isRtl ? 'pr-[80px]' : 'pl-[80px]';

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-background text-start">
            <AnalystSidebar />
            <main className={`${mainPadding} p-6 transition-all duration-300`}>
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="max-w-7xl mx-auto space-y-6"
                >
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Data Health Dashboard</h1>
                            <p className="text-muted-foreground">Monitoring organizational data integrity and AI cleaning impact.</p>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-bold text-emerald-600">95% Institutional Quality Gate Active</span>
                        </div>
                    </div>

                    {/* Bento Grid layout */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* KPI Cards */}
                        <motion.div variants={item}>
                            <Card className="h-full">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Records Managed</CardTitle>
                                    <Database className="w-4 h-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats?.total_records?.toLocaleString() || "42,500"}</div>
                                    <p className="text-xs text-muted-foreground">+12% from last month</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div variants={item}>
                            <Card className="h-full border-indigo-100 bg-indigo-50/10 text-start">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Neutralized Errors</CardTitle>
                                    <Zap className="w-4 h-4 text-indigo-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-indigo-600">
                                        {stats?.neutralized_errors?.toLocaleString() || "1,248"}
                                    </div>
                                    <p className="text-xs text-muted-foreground">AI-driven corrections</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div variants={item}>
                            <Card className="h-full">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Average Health Gain</CardTitle>
                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-emerald-600">{stats?.health_gain || "87%"}</div>
                                    <p className="text-xs text-muted-foreground">Efficiency improvement</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div variants={item}>
                            <Card className="h-full border-amber-100 bg-amber-50/10">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Datasets Protected</CardTitle>
                                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats?.total_datasets || "24"}</div>
                                    <p className="text-xs text-muted-foreground">Global Repository sync</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Charts Area */}
                        <motion.div variants={item} className="md:col-span-2 md:row-span-2">
                            <Card className="h-full">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold">Data Integrity Gauge</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col items-center justify-center pt-6">
                                    <IntegrityGauge score={stats?.score || 92} />
                                    <div className="w-full mt-6 space-y-4">
                                        <div className="flex justify-between items-center text-sm border-t pt-4">
                                            <span className="text-muted-foreground">Compliance Status:</span>
                                            <span className={`font-bold ${(stats?.score || 92) >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {(stats?.score || 92) >= 95 ? "EXCELLENT" : "IMPROVEMENT TARGET"}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div variants={item} className="md:col-span-2">
                            <Card className="h-full">
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium">Error Reduction Impact</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={impactData}>
                                            <defs>
                                                <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                            <Tooltip />
                                            <Area type="monotone" dataKey="errors" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorErrors)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div variants={item} className="md:col-span-2">
                            <Card className="h-full">
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium">Error Type Distribution</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={errorBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {errorBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </motion.div>
            </main>
        </div>
    );
};

export default DataHealth;
