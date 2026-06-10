import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  TrendingUp, 
  Database, 
  ShieldCheck, 
  Briefcase,
  RefreshCw,
  AlertCircle,
  LayoutDashboard,
  Globe2,
  Activity
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAnalystOverview } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import PopulationChart from "@/components/dashboard/charts/PopulationChart";
import DataQualityChart from "@/components/dashboard/charts/DataQualityChart";
import EmploymentChart from "@/components/dashboard/charts/EmploymentChart";

const AnalystDashboard = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAnalystOverview("Tchad");
      setData(response);
      setError(null);
    } catch (err) {
      console.error("Error fetching analyst overview:", err);
      setError(t('error_fetching_data'));
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('error_fetching_data'),
      });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="p-8 space-y-8 bg-slate-50/50 dark:bg-slate-950/50 min-h-screen">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton className="h-[450px] lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-[450px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
          <AlertCircle className="w-12 h-12 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{error}</h2>
        <Button onClick={fetchData} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> {t('common_refresh')}
        </Button>
      </div>
    );
  }

  const cards = [
    {
      title: t('total_population'),
      value: data?.summary?.total_population 
        ? `${(data.summary.total_population / 1000000).toFixed(1)}${t('unit_millions_abbr')}`
        : "18.3M",
      subValue: "+3.2% vs 2023",
      icon: Users,
      lightColor: "bg-indigo-50 dark:bg-indigo-900/20",
      textColor: "text-indigo-600 dark:text-indigo-400"
    },
    {
      title: t('analyst_stats_records'),
      value: data?.summary?.total_records?.toLocaleString() || "39,312",
      subValue: t('source_sync_active'),
      icon: Database,
      lightColor: "bg-emerald-50 dark:bg-emerald-900/20",
      textColor: "text-emerald-600 dark:text-emerald-400"
    },
    {
      title: t('health_score_label'),
      value: `${data?.summary?.quality_score || 98}%`,
      subValue: t('database_reliable'),
      icon: ShieldCheck,
      lightColor: "bg-amber-50 dark:bg-amber-900/20",
      textColor: "text-amber-600 dark:text-amber-400"
    },
    {
      title: t('employment_rate'),
      value: "42.5%",
      subValue: "15-49 age group",
      icon: Briefcase,
      lightColor: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-600 dark:text-blue-400"
    }
  ];

  return (
    <div className={`p-8 space-y-8 bg-slate-50/50 dark:bg-slate-950/50 min-h-screen ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t('dashboard_analyst_title')}
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-indigo-500/60" />
            {t('dashboard_analyst_subtitle')}
          </p>
        </motion.div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button 
            onClick={fetchData} 
            variant="outline" 
            size="lg" 
            disabled={loading}
            className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm border-slate-200 h-12 px-6"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="font-bold">{t('common_refresh')}</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {cards.map((card, idx) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="relative group"
            >
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm group-hover:shadow-md transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div className={`p-3 rounded-xl ${card.lightColor} ${card.textColor}`}>
                    <card.icon className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.title}</span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">{card.value}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">{card.subValue}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <PopulationChart data={data?.population_trend} />
          <EmploymentChart data={data?.employment_distribution} />
        </div>
        <div className="space-y-8">
          <DataQualityChart data={data?.summary?.quality_score} />
          
          {/* Recent Activity Mini-Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {t('dh_recent_activity')}
              </h3>
            </div>
            <div className="space-y-6">
              {[
                { label: "Gold Standard Sync", time: "2h ago", color: "bg-emerald-500" },
                { label: "Predictive Model Update", time: "5h ago", color: "bg-blue-500" },
                { label: "Data Quality Audit", time: "1d ago", color: "bg-amber-500" }
              ].map((activity, i) => (
                <div key={i} className="flex gap-4 items-start group cursor-pointer">
                  <div className={`w-2 h-2 mt-2 rounded-full ${activity.color} group-hover:scale-150 transition-transform`} />
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">
                      {activity.label}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mt-2">
                {t('dh_view_all')}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AnalystDashboard;
