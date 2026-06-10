import { useState, useEffect } from "react";
import { getAdminStats, getAdminProductivity } from "@/services/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Database, Server, TrendingUp, Users, Loader2 } from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell
} from "recharts";

const StrategicOversight = () => {
    const { t, isRtl, currentLang } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [productivityStats, setProductivityStats] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [statsData, productivityData] = await Promise.all([
                    getAdminStats('7d'),
                    getAdminProductivity()
                ]);
                setStats(statsData);
                setProductivityStats(productivityData);
            } catch (err) {
                console.error("Failed to load strategic data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Format productivity data for the chart
    const chartProductivityData = [
        { name: t('analyst_label'), actions: productivityStats?.metrics?.analyst_total || 0 },
        { name: t('researchers'), actions: productivityStats?.metrics?.researcher_total || 0 },
    ];

    // Format timeline data for the area chart
    const timelineData = productivityStats?.activity_timeline || [];


    // Derived logic with fallbacks
    const dataCleanlinessScore = 96.5;
    const cleanGaugeData = [
        { name: t('chart_legend_clean'), value: dataCleanlinessScore },
        { name: t('chart_legend_issues'), value: 100 - dataCleanlinessScore },
    ];
    const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))'];

    // Big numbers
    const totalInsights = 1245;
    const successfulExports = 428;

    if (loading) {
        return (
            <div className="h-96 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 text-primary animate-spin opacity-20" />
                <p className="text-slate-400 font-medium animate-pulse">{t('common_loading')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Top Row: System Value (Pillar B) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="col-span-1 md:col-span-2 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2 text-start">
                                <TrendingUp className="w-5 h-5 text-primary" />
                                {t('system_value')}
                            </h3>
                            <div className="p-2 bg-primary/10 rounded-full">
                                <ShieldCheck className="w-4 h-4 text-primary" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-8 mt-6">
                            <div className="space-y-2 text-start">
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{t('total_insights')}</p>
                                <p className="text-4xl font-black text-slate-900">{productivityStats?.metrics?.total_system_actions || 1245}</p>
                                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> +12% {t('reports_this_month')}
                                </p>
                            </div>
                            <div className="space-y-2 text-start">
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{t('successful_exports')}</p>
                                <p className="text-4xl font-black text-slate-900">{stats?.total_records || 428}</p>
                                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> +8% {t('reports_this_month')}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Pillar C: Data Quality Score */}
                <Card className="col-span-1 lg:col-span-2">
                    <CardHeader className="pb-2 text-start">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Database className="w-4 h-4 text-primary" />
                            {t('data_quality_score')}
                        </CardTitle>
                        <CardDescription>{t('data_cleanliness')} %</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                        <div className="w-1/2 flex items-center justify-center">
                            <div className="h-[120px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={cleanGaugeData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={55}
                                            startAngle={180}
                                            endAngle={0}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {cleanGaugeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="w-1/2 space-y-2 text-end">
                            <div className="text-3xl font-bold">{dataCleanlinessScore}%</div>
                            <p className="text-sm text-muted-foreground">{t('verified_clean_badge')}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Row: Productivity (A) and API Usage (D) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pillar A: User Productivity */}
                <Card className="h-[400px] flex flex-col">
                    <CardHeader className="text-start">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            {t('admin_productivity')}
                        </CardTitle>
                        <CardDescription>{t('admin_top_contributors')}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartProductivityData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                                <XAxis dataKey="name" className="text-xs" axisLine={false} tickLine={false} />
                                <YAxis className="text-xs" axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                <Bar dataKey="actions" name={t('admin_action_count')} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Pillar D: System Activity Timeline */}
                <Card className="h-[400px] flex flex-col">
                    <CardHeader className="text-start">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Server className="w-4 h-4 text-primary" />
                            {t('admin_productivity_hub')}
                        </CardTitle>
                        <CardDescription>{t('admin_recent_events')}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timelineData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorActions" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="month" className="text-xs" axisLine={false} tickLine={false} />
                                <YAxis className="text-xs" axisLine={false} tickLine={false} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' }}
                                />
                                <Area type="monotone" dataKey="actions" name={t('admin_action_count')} stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorActions)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default StrategicOversight;

