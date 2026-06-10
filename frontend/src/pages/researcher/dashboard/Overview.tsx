import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, TrendingUp, TrendingDown, Users, FileText, Database, Activity, Sparkles, Clock, Globe } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { getResearcherOverviewStats } from "@/services/api";

const Overview = () => {
  const { t, isRtl } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchData = async () => {
    try {
      const res = await getResearcherOverviewStats();
      setData(res);
      setError(false);
    } catch (err) {
      console.error("Error fetching overview stats:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/20 opacity-75"></span>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          {t("data_initializing", undefined, "Chargement des données en temps réel...")}
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl max-w-md mx-auto mt-12">
        <Activity className="h-12 w-12 text-destructive mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-foreground mb-2">
          {t("error_fetching_data", undefined, "Erreur de connexion")}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {t("error_server_connection", undefined, "Impossible de se connecter au serveur de données de l'INSEED.")}
        </p>
        <button
          onClick={() => {
            setLoading(true);
            fetchData();
          }}
          className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm shadow-md"
        >
          {t("common_refresh", undefined, "Réessayer")}
        </button>
      </div>
    );
  }

  const { summary, population_trend, region_distribution, employment_sector } = data;

  // Chart Color System
  const CHART_COLORS = [
    "hsl(var(--chart-1))", 
    "hsl(var(--chart-2))", 
    "hsl(var(--chart-3))", 
    "hsl(var(--chart-4))", 
    "hsl(var(--chart-5))"
  ];

  // Map and capitalize sector data for donut chart
  const sectorData = employment_sector.map((item: any) => ({
    name: t(`sector_${item.sector}`, undefined, item.sector.charAt(0).toUpperCase() + item.sector.slice(1)),
    value: item.value
  }));

  // Take top 6 populated provinces for a highly readable regional bar chart
  const topRegions = region_distribution.slice(0, 6).map((item: any) => ({
    name: t(`region_${item.name.replace(/[^a-zA-Z]/g, '')}`, undefined, item.name),
    value: item.value
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-8 mt-4 px-4 pb-12 animate-fade-in">
      
      {/* Header with Dashboard Meta and Live Sync Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="text-start">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            {t("side_nav_overview", undefined, "Vue d'ensemble")}
            <Sparkles className="h-5 w-5 text-primary opacity-80" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("dashboard_inseed_platform", undefined, "DataVision Tchad - Plateforme d'analyse INSEED")}
          </p>
        </div>

        {/* AUTHORITATIVE PULSE INDICATOR FOR INSEED DATA SYNC */}
        <div className="flex items-center self-start md:self-auto">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold tracking-wide uppercase shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-extrabold tracking-wider">
              {t("source_sync_active", undefined, "Synchronisation INSEED en Direct")}
            </span>
          </div>
        </div>
      </div>

      {/* BENTO BOX GRID LAYOUT - STATS CARDS */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Total Population Bento Card (Larger) */}
        <Card className="lg:col-span-2 md:col-span-2 col-span-1 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl overflow-hidden hover:scale-[1.01] transition-all duration-300">
          <CardHeader className={`flex flex-row items-center justify-between p-6 pb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="text-start">
              <CardTitle className="text-xs uppercase font-extrabold text-muted-foreground tracking-wider">
                {t("total_population", undefined, "Population totale")}
              </CardTitle>
              <CardDescription className="text-[10px] text-muted-foreground">
                {t("census_label", undefined, "Recensement national officiel")}
              </CardDescription>
            </div>
            <div className="p-3 rounded-2xl bg-chart-1/10 text-chart-1 shadow-inner">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 text-start">
            <div className="flex items-baseline gap-2 mt-2">
              <div className="text-4xl font-black tracking-tight text-foreground">
                {(summary.total_population / 1000000).toFixed(2)}
              </div>
              <div className="text-lg font-bold text-muted-foreground">
                {t("unit_millions", undefined, "Millions")}
              </div>
            </div>
            <p className={`text-xs font-bold mt-3 flex items-center gap-1.5 ${isRtl ? "flex-row-reverse text-emerald-400" : "text-emerald-600"}`}>
              <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
              <span>
                {summary.growth_rate}% {t("from_last_year", undefined, "par rapport à l'an dernier")}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Growth Rate Bento Card */}
        <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl overflow-hidden hover:scale-[1.01] transition-all duration-300">
          <CardHeader className={`flex flex-row items-center justify-between p-6 pb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="text-start">
              <CardTitle className="text-xs uppercase font-extrabold text-muted-foreground tracking-wider">
                {t("growth_label", undefined, "Taux de croissance")}
              </CardTitle>
              <CardDescription className="text-[10px] text-muted-foreground">
                {t("annual_average", undefined, "Moyenne annuelle")}
              </CardDescription>
            </div>
            <div className="p-3 rounded-2xl bg-chart-2/10 text-chart-2 shadow-inner">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 text-start">
            <div className="flex items-baseline gap-1 mt-2">
              <div className="text-4xl font-black tracking-tight text-foreground">
                +{summary.growth_rate}%
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground mt-3 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {t("calculated_cagr", undefined, "Calculé sur les 2 dernières années")}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Active Sectors Bento Card */}
        <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl overflow-hidden hover:scale-[1.01] transition-all duration-300">
          <CardHeader className={`flex flex-row items-center justify-between p-6 pb-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className="text-start">
              <CardTitle className="text-xs uppercase font-extrabold text-muted-foreground tracking-wider">
                {t("active_sectors", undefined, "Secteurs actifs")}
              </CardTitle>
              <CardDescription className="text-[10px] text-muted-foreground">
                {t("labor_force_distribution", undefined, "Branches de production")}
              </CardDescription>
            </div>
            <div className="p-3 rounded-2xl bg-chart-3/10 text-chart-3 shadow-inner">
              <Database className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 text-start">
            <div className="flex items-baseline gap-1 mt-2">
              <div className="text-4xl font-black tracking-tight text-foreground">
                {summary.active_sectors}
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground mt-3 flex items-center gap-1">
              <Globe className="h-3.5 w-3.5 text-primary opacity-60" />
              <span>
                {t("sectors_tracked", undefined, "Secteurs d'activité surveillés")}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* BENTO BOX GRID LAYOUT - VISUALIZATIONS */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        
        {/* Population Growth Trend AreaChart Card */}
        <Card className="lg:col-span-2 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader className="p-6 text-start">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-foreground">
                  {t("population_growth_trend", undefined, "Tendance de Croissance de la Population")}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {t("historical_population_data", undefined, "Trajectoire démographique nationale (2009-2050)")}
                </CardDescription>
              </div>
              <span className="text-[10px] bg-primary/5 border border-primary/10 text-primary font-bold px-2 py-1 rounded-md">
                2009 - 2050
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-[340px] p-6 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={population_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="popColorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis 
                  dataKey="year" 
                  fontSize={10} 
                  stroke="#94a3b8" 
                  tickLine={false} 
                  axisLine={false} 
                  reversed={isRtl} 
                />
                <YAxis 
                  fontSize={10} 
                  stroke="#94a3b8" 
                  tickLine={false} 
                  axisLine={false} 
                  orientation={isRtl ? "right" : "left"} 
                  unit="M"
                />
                <Tooltip 
                  contentStyle={{ 
                    background: "rgba(255,255,255,0.9)", 
                    border: "1px solid rgba(226, 232, 240, 0.8)", 
                    borderRadius: "12px", 
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)", 
                    fontSize: "11px", 
                    textAlign: isRtl ? "right" : "left" 
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="population" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={3} 
                  fillOpacity={1}
                  fill="url(#popColorGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Employment by Sector modern Donut Chart Card */}
        <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader className="p-6 text-start">
            <CardTitle className="text-base font-black text-foreground">
              {t("employment_by_sector", undefined, "Emploi par secteur")}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {t("labor_force_distribution", undefined, "Répartition de la population active par secteur d'activité")}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[340px] p-6 pt-0 relative flex flex-col justify-between">
            <div className="relative h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={sectorData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={65} 
                    outerRadius={85} 
                    paddingAngle={6} 
                    dataKey="value"
                  >
                    {sectorData.map((_: any, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CHART_COLORS[index % CHART_COLORS.length]} 
                        stroke="rgba(255,255,255,0.4)" 
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: "rgba(255,255,255,0.9)", 
                      border: "none", 
                      borderRadius: "8px", 
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)", 
                      fontSize: "11px" 
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Donut Center Label showing Total Workforce */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <div className="text-[10px] text-muted-foreground uppercase font-extrabold tracking-wider">
                  {t("total_workforce", undefined, "Actifs")}
                </div>
                <div className="text-xl font-black text-foreground">
                  {(summary.total_workforce / 1000000).toFixed(2)}M
                </div>
              </div>
            </div>

            {/* Custom Legend underneath donut */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2 border-t border-border/30 pt-4">
              {sectorData.map((item: any, idx: number) => (
                <div key={item.name} className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="h-2 w-2 rounded-full" 
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                    ></span>
                    <span className="font-bold text-muted-foreground truncate max-w-[70px]">{item.name}</span>
                  </div>
                  <span className="font-black text-foreground mt-0.5">
                    {((item.value / summary.total_workforce) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Regional Distribution Horizontal BarChart Card */}
        <Card className="lg:col-span-3 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader className="p-6 text-start">
            <CardTitle className="text-base font-black text-foreground">
              {t("regional_distribution", undefined, "Distribution régionale")}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {t("population_by_region", undefined, "Top 6 des provinces du Tchad par population totale (en Millions)")}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[260px] p-6 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                layout="vertical" 
                data={topRegions} 
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis 
                  type="number" 
                  fontSize={10} 
                  stroke="#94a3b8" 
                  tickLine={false} 
                  axisLine={false} 
                  unit="M"
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  fontSize={10} 
                  stroke="#94a3b8" 
                  tickLine={false} 
                  axisLine={false} 
                  width={110}
                  className="font-bold"
                />
                <Tooltip 
                  cursor={{ fill: "rgba(148, 163, 184, 0.05)" }}
                  contentStyle={{ 
                    background: "rgba(255,255,255,0.9)", 
                    border: "none", 
                    borderRadius: "8px", 
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)", 
                    fontSize: "11px" 
                  }} 
                />
                <Bar 
                  dataKey="value" 
                  fill="hsl(var(--chart-2))" 
                  radius={[0, 6, 6, 0]} 
                  barSize={16} 
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* RECENT PLATFORM ACTIVITY CARD */}
      <Card className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl">
        <CardHeader className="p-6 text-start flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-black text-foreground">
              {t("recent_activity", undefined, "Activité récente")}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {t("recent_actions", undefined, "Flux d'activité en direct sur la base de données INSEED")}
            </CardDescription>
          </div>
          <Activity className="h-5 w-5 text-muted-foreground opacity-55" />
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="space-y-3">
            {[
              { action: t("overview_census_uploaded", undefined, "Nouveau recensement démographique validé"), dataset: "INSEED Gold Standard Baseline", time: `2 ${t("overview_hours_ago", undefined, "heures plus tôt")}` },
              { action: t("overview_forecast_updated", undefined, "Simulations de fécondité recalculées"), dataset: "Population Projections Ensemble", time: `5 ${t("overview_hours_ago", undefined, "heures plus tôt")}` },
              { action: t("side_nav_generate_report", undefined, "Rapport d'audit statistique généré"), dataset: "Tchad Demographic Report 2026", time: `1 ${t("overview_day_ago", undefined, "jour plus tôt")}` },
            ].map((activity, index) => (
              <div 
                key={index} 
                className={`flex items-center justify-between p-4 rounded-2xl border border-border/20 bg-muted/10 hover:bg-muted/20 transition-all duration-300 ${isRtl ? "flex-row-reverse" : ""}`}
              >
                <div className="text-start flex items-center gap-4">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse-glow"></div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{activity.action}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{activity.dataset}</p>
                  </div>
                </div>
                <span className="text-[9px] font-extrabold text-muted-foreground bg-white dark:bg-slate-800 px-2.5 py-1 rounded-full border border-border/40 shadow-sm">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Overview;
