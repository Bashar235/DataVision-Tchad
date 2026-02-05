
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, AreaChart, Area
} from 'recharts';
import { getAdminStats } from "@/services/api"; // We will update this or use a new one

const Visualization = () => {
    const { user, loading: authLoading } = useAuth();
    const { t, currentLang } = useLanguage();
    const [period, setPeriod] = useState("7d");
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const formatDate = (dateString: string) => {
        if (!dateString) return "";
        return new Intl.DateTimeFormat(currentLang, {
            month: 'short',
            day: 'numeric'
        }).format(new Date(dateString));
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Pass period to API
                const data = await getAdminStats(period);
                setStats(data);
            } catch (error) {
                console.error("Failed to fetch visualization data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [period, currentLang]);

    // Mock data for charts (replace with real data from stats later)
    const chartData = [
        { date: '2024-01-25', activity: 400, mobile: 240 },
        { date: '2024-01-26', activity: 300, mobile: 139 },
        { date: '2024-01-27', activity: 200, mobile: 980 },
        { date: '2024-01-28', activity: 278, mobile: 390 },
        { date: '2024-01-29', activity: 189, mobile: 480 },
        { date: '2024-01-30', activity: 239, mobile: 380 },
        { date: '2024-01-31', activity: 349, mobile: 430 },
    ];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-950/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-800 shadow-xl">
                    <p className="text-xs font-medium text-slate-300 mb-1">{formatDate(label)}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm font-bold text-white">
                            {entry.name}: {entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex h-screen bg-slate-50/50">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto p-8 lg:p-12">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header with Title and Filter */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                                {authLoading || !user ? (
                                    <Skeleton className="h-10 w-64 rounded-lg bg-slate-200" />
                                ) : (
                                    `${t('visualization_for')} ${user.full_name}`
                                )}
                            </h1>
                            <p className="text-slate-500 mt-1">
                                {t('visualization_subtitle')}
                            </p>
                        </div>

                        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <Tabs value={period} onValueChange={setPeriod} className="w-full">
                                <TabsList className="grid w-full grid-cols-3 bg-transparent h-9">
                                    <TabsTrigger
                                        value="7d"
                                        className="text-xs font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 rounded-lg px-3"
                                    >
                                        7 Days
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="30d"
                                        className="text-xs font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 rounded-lg px-3"
                                    >
                                        30 Days
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="all"
                                        className="text-xs font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 rounded-lg px-3"
                                    >
                                        All Time
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i} className="rounded-2xl border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white overflow-hidden">
                                <CardContent className="p-6">
                                    {loading ? (
                                        <div className="space-y-3">
                                            <Skeleton className="h-4 w-24 bg-slate-100" />
                                            <Skeleton className="h-8 w-16 bg-slate-200" />
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm font-medium text-slate-500">Total Users</p>
                                            <h3 className="text-2xl font-bold text-slate-900 mt-2">12,345</h3>
                                            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full font-medium">
                                                +12% this week
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Main Charts Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Activity Chart */}
                        <Card className="rounded-2xl border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white h-full">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold text-slate-950">System Activity</CardTitle>
                                <CardDescription>User logins and actions over time</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[350px] w-full">
                                    {loading ? (
                                        <Skeleton className="h-full w-full rounded-xl bg-slate-50" />
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis
                                                    dataKey="date"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                                    tickFormatter={(date) => formatDate(date)}
                                                    dy={10}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                                />
                                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                                <Area
                                                    type="monotone"
                                                    dataKey="activity"
                                                    stroke="#6366f1"
                                                    strokeWidth={3}
                                                    fillOpacity={1}
                                                    fill="url(#colorActivity)"
                                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Data Volume Chart */}
                        <Card className="rounded-2xl border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white h-full">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold text-slate-950">Data Volume Trends</CardTitle>
                                <CardDescription>New records added per period</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[350px] w-full">
                                    {loading ? (
                                        <Skeleton className="h-full w-full rounded-xl bg-slate-50" />
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={32}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis
                                                    dataKey="date"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                                    tickFormatter={(date) => formatDate(date)}
                                                    dy={10}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                                />
                                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                                <Bar
                                                    dataKey="mobile"
                                                    fill="#0f172a"
                                                    radius={[6, 6, 0, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>


                </div>
            </main>
        </div>
    );
};

export default Visualization;
