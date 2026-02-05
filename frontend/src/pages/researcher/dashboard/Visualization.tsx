import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download, Filter, RefreshCw, Loader2 } from "lucide-react";
import { getResearchTrends, scheduleExport } from "@/services/api";
import { useLanguage } from "@/contexts/LanguageContext";
import * as XLSX from 'xlsx';
import ScheduleDialog from "@/components/ScheduleDialog";
import { Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-950 p-3 border border-slate-100 dark:border-slate-800 shadow-xl rounded-lg">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-500 dark:text-slate-400 capitalize">{entry.name}:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-50">
              {entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const Visualization = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState("2023");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleConfirmSchedule = async (formData: { scheduledTime: string; details: string }) => {
    try {
      await scheduleExport(formData.scheduledTime, formData.details);
      toast({
        title: "Succès",
        description: "L'export a été planifié avec succès."
      });
    } catch (error) {
      console.error("Failed to schedule export", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Échec de la planification."
      });
    }
  };

  // Fetch Logic
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch data for the selected region, or null for 'all'
        const regionParam = selectedRegion === 'all' ? null : selectedRegion;
        const result = await getResearchTrends(regionParam);
        setRawData(result.data || []);
      } catch (error) {
        console.error("Failed to fetch trends", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedRegion]); // Fetch when region changes. Locally filter years for performance.

  // --- Data Processing Engine ---

  // 1. Filtered Data (Region & Year)
  const filteredData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    if (selectedRegion === 'all') {
      // For "All Regions", we sum the individual regions. 
      // Filter out pre-aggregated "National" entries to avoid doubling.
      return rawData.filter(d => d.region && d.region.toLowerCase() !== 'national');
    }

    // Case-insensitive specific region matching
    return rawData.filter(d =>
      d.region && d.region.toLowerCase() === selectedRegion.toLowerCase()
    );
  }, [rawData, selectedRegion]);

  // 2. Population Trend (Area Chart)
  const populationTrend = useMemo(() => {
    const grouped = filteredData.reduce((acc: any, curr: any) => {
      if (!acc[curr.year]) acc[curr.year] = { year: curr.year, population: 0 };
      acc[curr.year].population += (curr.population || 0);
      return acc;
    }, {});

    const trend = Object.values(grouped).sort((a: any, b: any) => a.year - b.year);

    // Gap Filling: Ensure years 2020-2030 are present
    const fullTrend = [];
    let lastPop = 0;
    for (let y = 2020; y <= 2030; y++) {
      const entry = (trend as any[]).find((d: any) => d.year === y);
      if (entry) {
        lastPop = entry.population;
        fullTrend.push(entry);
      } else if (lastPop > 0) {
        fullTrend.push({ year: y, population: lastPop });
      } else {
        fullTrend.push({ year: y, population: 0 });
      }
    }
    return fullTrend;
  }, [filteredData]);

  // 3. Fertility Trend (Area Chart)
  // For 'All', we Average the fertility rates.
  const fertilityTrend = useMemo(() => {
    const grouped = filteredData.reduce((acc: any, curr: any) => {
      if (!acc[curr.year]) acc[curr.year] = { year: curr.year, rate: 0, count: 0 };
      acc[curr.year].rate += (curr.fertility_rate || 0);
      acc[curr.year].count += 1;
      return acc;
    }, {});

    const trend = Object.values(grouped).map((d: any) => ({
      year: d.year,
      rate: Number((d.rate / d.count).toFixed(2))
    })).sort((a: any, b: any) => a.year - b.year);

    // Gap Filling: Ensure years 2020-2030 are present
    const fullTrend = [];
    let lastRate = 0;
    for (let y = 2020; y <= 2030; y++) {
      const entry = (trend as any[]).find((d: any) => d.year === y);
      if (entry) {
        lastRate = entry.rate;
        fullTrend.push(entry);
      } else if (lastRate > 0) {
        fullTrend.push({ year: y, rate: lastRate });
      } else {
        fullTrend.push({ year: y, rate: 0 });
      }
    }
    return fullTrend;
  }, [filteredData]);

  // 4. Age Distribution (Donut Chart) - Aggregated for Selected Year
  const ageData = useMemo(() => {
    const yearData = filteredData.filter(d => d.year === Number(selectedYear));

    const sums = yearData.reduce((acc: any, curr: any) => ({
      age_0_14: acc.age_0_14 + (curr.age_0_14 || 0),
      age_15_64: acc.age_15_64 + (curr.age_15_64 || 0),
      age_65_plus: acc.age_65_plus + (curr.age_65_plus || 0),
    }), { age_0_14: 0, age_15_64: 0, age_65_plus: 0 });

    const total = sums.age_0_14 + sums.age_15_64 + sums.age_65_plus;
    if (total === 0) return [];

    return [
      { name: "0-14", value: sums.age_0_14, fill: "#4f46e5" }, // Indigo
      { name: "15-64", value: sums.age_15_64, fill: "#10b981" }, // Emerald
      { name: "65+", value: sums.age_65_plus, fill: "#f59e0b" }  // Amber
    ];
  }, [filteredData, selectedYear]);

  // 5. GDP Selection (Horizontal Bar) - Top 10 Regions for Selected Year
  // If 'all' is selected, show top 10 regions from ALL data. 
  // If specific region is selected, just show that one bar (or top neighbors? simpler to just show the one).
  const gdpByRegion = useMemo(() => {
    // source from raw but exclude "National"
    const yearData = rawData.filter(d =>
      d.year === Number(selectedYear) &&
      d.region && d.region.toLowerCase() !== 'national'
    );

    let processed = yearData.reduce((acc: any, curr: any) => {
      const reg = curr.region;
      if (!acc[reg]) acc[reg] = 0;
      acc[reg] += curr.gdp_contribution || 0;
      return acc;
    }, {});

    const chartData = Object.keys(processed).map(r => ({
      region: r,
      gdp: processed[r]
    }));

    return chartData.sort((a, b) => b.gdp - a.gdp).slice(0, 10);
  }, [rawData, selectedYear]);

  // 6. Employment (Stacked Area)
  const employmentTrend = useMemo(() => {
    const grouped = filteredData.reduce((acc: any, curr: any) => {
      if (!acc[curr.year]) acc[curr.year] = { year: curr.year, agri: 0, ind: 0, serv: 0, count: 0 };
      acc[curr.year].agri += (curr.employment_agriculture || 0);
      acc[curr.year].ind += (curr.employment_industry || 0);
      acc[curr.year].serv += (curr.employment_services || 0);
      acc[curr.year].count += 1;
      return acc;
    }, {});

    const trend = Object.values(grouped).map((d: any) => ({
      year: d.year,
      agriculture: Number((d.agri / d.count).toFixed(1)),
      industry: Number((d.ind / d.count).toFixed(1)),
      services: Number((d.serv / d.count).toFixed(1)),
    })).sort((a: any, b: any) => a.year - b.year);

    // Gap Filling: Ensure years 2020-2030 are present
    const fullTrend = [];
    let lastData = { agriculture: 0, industry: 0, services: 0 };
    for (let y = 2020; y <= 2030; y++) {
      const entry = trend.find((d: any) => d.year === y) as any;
      if (entry) {
        lastData = { agriculture: entry.agriculture, industry: entry.industry, services: entry.services };
        fullTrend.push(entry);
      } else if (lastData.agriculture > 0 || lastData.industry > 0 || lastData.services > 0) {
        fullTrend.push({ year: y, ...lastData });
      } else {
        fullTrend.push({ year: y, agriculture: 0, industry: 0, services: 0 });
      }
    }
    return fullTrend;
  }, [filteredData]);


  // Handler: Export
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Research_Data");
    XLSX.writeFile(wb, `DataVision_Export_${selectedRegion}_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-6 relative">
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${isRtl ? 'md:flex-row-reverse' : ''}`}>
        <div className="text-start">
          <h1 className="text-3xl font-bold tracking-tight">
            {selectedRegion === 'all' ? t('national_overview') : selectedRegion}
          </h1>
          <p className="text-muted-foreground mt-1">
            {selectedRegion === 'all' ? t('analyzing_trends') : `${t('deep_dive_analysis')} ${selectedRegion}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className={isRtl ? 'flex-row-reverse' : ''} onClick={() => setIsExportModalOpen(true)}>
            <Clock className={`h-4 w-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
            {t('schedule_export') || 'Schedule Export'}
          </Button>
          <Button variant="outline" size="sm" className={isRtl ? 'flex-row-reverse' : ''} onClick={handleExport}>
            <Download className={`h-4 w-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
            {t('export_report')}
          </Button>
        </div>
      </div>

      <Card className="border-t-4 border-primary/20 shadow-sm">
        <CardHeader className="pb-3 text-start">
          <CardTitle className={`flex items-center gap-2 text-base font-medium ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Filter className="h-4 w-4 text-muted-foreground" />
            {t('analysis_filters')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block text-start">{t('target_region')}</label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="w-full bg-background text-start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🇹🇩 {t('all_regions')}</SelectItem>
                  <SelectItem value="N'Djamena">N'Djamena</SelectItem>
                  <SelectItem value="Logone Occidental">Logone Occidental</SelectItem>
                  <SelectItem value="Mayo-Kebbi Est">Mayo-Kebbi Est</SelectItem>
                  <SelectItem value="Mandoul">Mandoul</SelectItem>
                  <SelectItem value="Ouaddaï">Ouaddaï</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block text-start">{t('select_years')}</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="bg-background text-start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028', '2029', '2030'].map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="demographic" className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <TabsList className="grid w-full grid-cols-2 lg:w-auto">
          <TabsTrigger value="demographic">{t('demographic')}</TabsTrigger>
          <TabsTrigger value="economic">{t('economic')}</TabsTrigger>
        </TabsList>

        <div className="relative min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">{t('updating_analytics')}</p>
              </div>
            </div>
          )}

          <TabsContent value="demographic" className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>

            {/* 1. Population Trend */}
            <Card className="h-[280px] flex flex-col bg-white/70 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:bg-white/80">
              <CardHeader className="text-start pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('population_trend')} ({selectedYear})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={populationTrend}>
                    <defs>
                      <linearGradient id="colorIndigo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} fontSize={11} stroke="#64748b" reversed={isRtl} />
                    <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="#64748b" orientation={isRtl ? 'right' : 'left'} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="population" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorIndigo)" name={t('total_population')} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 2. Fertility Trend */}
            <Card className="h-[280px] flex flex-col bg-white/70 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:bg-white/80">
              <CardHeader className="text-start pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('fertility_rate_evolution')} ({selectedYear})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={fertilityTrend}>
                    <defs>
                      <linearGradient id="colorIndigoRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} fontSize={11} stroke="#64748b" reversed={isRtl} />
                    <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} fontSize={11} stroke="#64748b" orientation={isRtl ? 'right' : 'left'} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="rate" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorIndigoRate)" name={t('birth_rate')} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 3. Age Distribution (Donut) */}
            <Card className="h-[280px] flex flex-col bg-white/70 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:bg-white/80">
              <CardHeader className="text-start pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('age_distribution')} ({selectedYear})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 flex items-center justify-center relative">
                {ageData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ageData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {ageData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mb-2" />
                    <span className="text-xs">Initializing Data...</span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                  <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{selectedYear}</span>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="economic" className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>

            {/* 1. Employment Sector (Stacked Area) */}
            <Card className="col-span-1 lg:col-span-2 h-[280px] flex flex-col bg-white/70 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:bg-white/80">
              <CardHeader className="text-start pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('employment_by_sector')} ({selectedYear})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={employmentTrend}>
                    <defs>
                      <linearGradient id="colorServ" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorInd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorAgri" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} fontSize={11} stroke="#64748b" reversed={isRtl} />
                    <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="#64748b" orientation={isRtl ? 'right' : 'left'} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" />
                    <Area type="monotone" dataKey="agriculture" stackId="1" stroke="#f43f5e" fill="url(#colorAgri)" name={t('agriculture')} />
                    <Area type="monotone" dataKey="industry" stackId="1" stroke="#06b6d4" fill="url(#colorInd)" name={t('industry')} />
                    <Area type="monotone" dataKey="services" stackId="1" stroke="#8b5cf6" fill="url(#colorServ)" name={t('services')} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 2. GDP By Region (Bar Chart - Horizontal) */}
            <Card className="h-[280px] flex flex-col bg-white/70 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:bg-white/80">
              <CardHeader className="text-start pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('gdp_by_region')} ({selectedYear})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gdpByRegion} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} fontSize={10} stroke="#64748b" hide />
                    <YAxis dataKey="region" type="category" width={80} axisLine={false} tickLine={false} fontSize={10} stroke="#64748b" orientation={isRtl ? 'right' : 'left'} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="gdp" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} name={t('gdp_growth')} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

          </TabsContent>
        </div>
      </Tabs>

      <ScheduleDialog
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onConfirm={handleConfirmSchedule}
      />
    </div >
  );
};

export default Visualization;
