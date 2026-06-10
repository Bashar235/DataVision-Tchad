import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { getHealthStats, getActivityStats, getActivityTimeline } from "@/services/api";
import { useEffect, useState } from "react";
import { 
    Database, ShieldCheck, Zap, TrendingUp, 
    Clock, CheckCircle2, FileText, BarChart2, Calendar,
    ArrowUpRight, Activity, Award
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fr, arSA, enUS } from 'date-fns/locale';

const DataHealth = () => {
    const { t, currentLang, isRtl } = useLanguage();
    const [stats, setStats] = useState<any>(null);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sessionTime, setSessionTime] = useState<string>("00:00:00");
    const [healthScore, setHealthScore] = useState<number>(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsData, timelineData, healthData] = await Promise.all([
                    getActivityStats(),
                    getActivityTimeline(),
                    getHealthStats()
                ]);
                setStats(statsData);
                setTimeline(timelineData);
                setHealthScore(healthData.score || 0);
            } catch (error) {
                console.error("Failed to fetch activity data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        // Session Timer Logic - Wrapped in try-catch for storage access safety
        try {
            const loginTimeStr = sessionStorage.getItem("loginTime");
            if (loginTimeStr) {
                const loginTime = new Date(loginTimeStr).getTime();
                if (!isNaN(loginTime)) {
                    const timer = setInterval(() => {
                        const now = new Date().getTime();
                        const diff = now - loginTime;

                        const hours = Math.floor(diff / 3600000);
                        const minutes = Math.floor((diff % 3600000) / 60000);
                        const seconds = Math.floor((diff % 60000) / 1000);

                        setSessionTime(
                            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                        );
                    }, 1000);
                    return () => clearInterval(timer);
                }
            }
        } catch (storageError) {
            console.warn("Storage access blocked by browser tracking prevention", storageError);
        }
    }, []);

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-[60vh]">
            <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
            />
        </div>
    );


    // Exact Time Formatting helper
    const formatExactTime = (timestamp: string) => {
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return t('common_unknown');
            return date.toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : currentLang === 'fr' ? 'fr-FR' : 'en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
        } catch (e) {
            return t('common_unknown');
        }
    };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            dir={isRtl ? "rtl" : "ltr"}
            className="max-w-7xl mx-auto space-y-8 mt-4 px-4 pb-12"
        >
            {/* Premium Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white/40 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-primary/10 rounded-2xl">
                        <Award className="w-10 h-10 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-none mb-2">
                            {t('dh_productivity_title')}
                        </h1>
                        <p className="text-slate-500 font-medium flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-500" />
                            {t('dh_productivity_subtitle')}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="flex-1 lg:flex-none bg-slate-900 text-white px-8 py-4 rounded-2xl flex items-center justify-between lg:justify-start gap-6 shadow-xl shadow-primary/10">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                                {t('dh_active_session')}
                            </span>
                        </div>
                        <span className="text-3xl font-mono font-black text-emerald-400">{sessionTime}</span>
                    </div>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { title: t('dh_data_processed'), value: stats?.clean_count || 0, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: t('dh_increase_yesterday') },
                    { title: t('dh_local_library'), value: stats?.upload_count || 0, icon: Database, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: t('dh_datasets_saved') },
                    { title: t('dh_reports_generated'), value: stats?.report_count || 0, icon: FileText, color: 'text-rose-600', bg: 'bg-rose-50', trend: t('dh_report_production_goal') },
                    { title: t('export_data'), value: stats?.export_count || 0, icon: ArrowUpRight, color: 'text-amber-600', bg: 'bg-amber-50', trend: t('dh_files_exported') }
                ].map((stat, i) => (
                    <motion.div key={i} variants={item}>
                        <Card className="border-none shadow-sm hover:shadow-xl transition-all duration-300 group cursor-default bg-white/60 backdrop-blur-sm overflow-hidden">
                            <CardContent className="p-6 relative">
                                <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} opacity-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500`} />
                                <div className="relative z-10">
                                    <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                        <stat.icon className="w-6 h-6" />
                                    </div>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">{stat.title}</p>
                                    <h3 className="text-3xl font-black text-slate-900 mb-2">
                                        {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                                    </h3>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                                        {stat.trend}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Activity Timeline */}
                <motion.div variants={item} className="lg:col-span-2">
                    <Card className="border-none shadow-xl bg-white h-full overflow-hidden flex flex-col">
                        <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-900 rounded-lg">
                                    <Clock className="w-5 h-5 text-white" />
                                </div>
                                <CardTitle className="text-xl font-black tracking-tight">{t('dh_recent_activity')}</CardTitle>
                            </div>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-black uppercase tracking-tighter text-slate-500">
                                    {timeline.length} {t('dh_events')}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-1">
                            <div className="p-8 space-y-6">
                                {Array.isArray(timeline) && timeline.map((entry, idx) => (
                                    <div key={entry.id} className="flex items-start gap-6 group relative">
                                        {idx !== timeline.length - 1 && (
                                            <div className="absolute left-[23px] top-10 bottom-[-24px] w-0.5 bg-slate-100 group-hover:bg-primary/20 transition-colors" />
                                        )}
                                        <div className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-white transition-all group-hover:scale-110 ${
                                            entry.action === 'CLEAN_DATA' ? 'bg-emerald-500 text-white' : 
                                            entry.action === 'UPLOAD_DATA' ? 'bg-indigo-500 text-white' : 'bg-rose-500 text-white'
                                        }`}>
                                            {entry.action === 'CLEAN_DATA' ? <CheckCircle2 className="w-5 h-5" /> : 
                                             entry.action === 'UPLOAD_DATA' ? <Database className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1 pt-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{entry.message}</h4>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter whitespace-nowrap ml-4">
                                                    {formatExactTime(entry.timestamp)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(entry.timestamp).toLocaleDateString(currentLang)}
                                                </div>
                                                <div className="px-2 py-0.5 rounded bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                    ID: {String(entry.id).substring(0, 8)}
                                                </div>
                                            </div>
                                        </div>
                                        <ArrowUpRight className="w-5 h-5 text-slate-300 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Right Column: Goals & Rewards */}
                <div className="space-y-8">
                    {/* Goal Progress */}
                    <motion.div variants={item}>
                        <Card className="border-none shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl" />
                            <CardHeader className="p-8 pb-4">
                                <div className="flex justify-between items-center mb-6">
                                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t('dh_daily_goals')}</CardTitle>
                                    <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-slate-400">{t('dh_data_cleaning_goal')}</span>
                                            <span className="text-emerald-400">{Math.min(100, Math.round(((stats?.clean_count || 0) / 10) * 100))}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden p-0.5">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, ((stats?.clean_count || 0) / 10) * 100)}%` }}
                                                className="h-full bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-slate-400">{t('dh_upload_goal')}</span>
                                            <span className="text-indigo-400">{Math.min(100, Math.round(((stats?.upload_count || 0) / 5) * 100))}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden p-0.5">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, ((stats?.upload_count || 0) / 5) * 100)}%` }}
                                                className="h-full bg-indigo-400 rounded-full shadow-[0_0_10px_rgba(129,140,248,0.5)]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 pt-4">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-400/20 rounded-xl flex items-center justify-center">
                                        <Award className="w-6 h-6 text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-0.5">{t('dh_next_badge')}</p>
                                        <p className="text-xs font-medium text-slate-300">{t('dh_badge_tip')}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Quick Stats Card */}
                    <motion.div variants={item}>
                        <Card className="border-none shadow-xl bg-white p-8 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                    <BarChart2 className="w-5 h-5" />
                                </div>
                                <h4 className="font-black tracking-tight">{t('dh_system_health')}</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{t('dh_uptime')}</p>
                                    <p className="text-xl font-black text-slate-900">99.9%</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{t('dh_latency')}</p>
                                    <p className="text-xl font-black text-slate-900">24ms</p>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};

export default DataHealth;
