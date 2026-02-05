import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getResearchTrends } from "@/services/api";
import { RefreshCw, TrendingUp, Users, Activity, BarChart3 } from "lucide-react";
import PopulationChart from "@/components/dashboard/charts/PopulationChart";
import EmploymentChart from "@/components/dashboard/charts/EmploymentChart";
import GDPChart from "@/components/dashboard/charts/GDPChart";
import AgeDistributionChart from "@/components/dashboard/charts/AgeDistributionChart";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

const VisualizationDashboard = () => {
  const { t, isRtl } = useLanguage();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [yearRange, setYearRange] = useState("all"); // all, 5y, 10y

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await getResearchTrends(selectedRegion === "all" ? null : selectedRegion);
        setData(result.data || []);
      } catch (error) {
        console.error("Failed to fetch visualization data", error);
      } finally {
        // partial delay for smooth UI transition
        setTimeout(() => setLoading(false), 500);
      }
    };
    fetchData();
  }, [selectedRegion]);

  // Filter Data based on Year Range
  const filteredData = useMemo(() => {
    let cutoffYear = 2000;
    if (yearRange === "5y") cutoffYear = 2020;
    if (yearRange === "10y") cutoffYear = 2015;

    return data.filter(d => d.year >= cutoffYear);
  }, [data, yearRange]);

  // Transform for Population Chart
  const populationData = useMemo(() => {
    const grouped = filteredData.reduce((acc: any[], curr: any) => {
      const existing = acc.find((item: any) => item.year === curr.year);
      // Aggregation: if region is 'all', we sum. If specific, it's already filtered.
      if (existing) {
        existing.population += (curr.population || 0);
      } else {
        acc.push({
          year: curr.year,
          population: curr.population || 0,
        });
      }
      return acc;
    }, []);

    return grouped.sort((a: any, b: any) => a.year - b.year).map((d: any) => ({
      ...d,
      population: Number((d.population / 1000000).toFixed(2)) // Convert to Millions
    }));
  }, [filteredData]);

  // Transform for GDP Chart
  const gdpData = useMemo(() => {
    const grouped = filteredData.reduce((acc: any, curr: any) => {
      if (!acc[curr.year]) acc[curr.year] = { year: curr.year, gdp: 0 };
      acc[curr.year].gdp += (curr.gdp_contribution || 0);
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => a.year - b.year).map((d: any) => ({
      year: d.year,
      gdp: Number((d.gdp / 1000).toFixed(2)) // Billions
    }));
  }, [filteredData]);

  // Transform for Employment
  const employmentData = useMemo(() => {
    if (filteredData.length === 0) return [];
    const grouped = filteredData.reduce((acc: any, curr: any) => {
      if (!acc[curr.year]) acc[curr.year] = {
        year: curr.year,
        agriculture: 0,
        industry: 0,
        services: 0,
        count: 0
      };
      acc[curr.year].agriculture += curr.employment_agriculture || 0;
      acc[curr.year].industry += curr.employment_industry || 0;
      acc[curr.year].services += curr.employment_services || 0;
      acc[curr.year].count += 1;
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => a.year - b.year).map((d: any) => ({
      year: d.year,
      // If 'all' is selected, we might want to average or show total indexed, 
      // but user asked for Sum/Aggregate for charts in general.
      // For employment rates, average is more logical, but for GDP/Pop it's Sum.
      agriculture: Math.round(d.agriculture / (selectedRegion === 'all' ? d.count : 1)),
      industry: Math.round(d.industry / (selectedRegion === 'all' ? d.count : 1)),
      services: Math.round(d.services / (selectedRegion === 'all' ? d.count : 1)),
    }));
  }, [filteredData, selectedRegion]);

  // Transform for Age Distribution Chart (Latest Year)
  const ageData = useMemo(() => {
    if (filteredData.length === 0) return null; // Trigger spinner

    const latestYear = Math.max(...filteredData.map(d => d.year));
    const latestData = filteredData.filter(d => d.year === latestYear);

    let acc014 = 0, acc1564 = 0, acc65plus = 0;
    latestData.forEach((d: any) => {
      acc014 += (d.age_0_14 || d['Age 0-14'] || 0);
      acc1564 += (d.age_15_64 || d['Age 15-64'] || 0);
      acc65plus += (d.age_65_plus || d['Age 65+'] || 0);
    });

    return { age014: acc014, age1564: acc1564, age65plus: acc65plus };
  }, [filteredData]);


  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div className="space-y-1 text-start">
          <h2 className="text-2xl font-bold tracking-tight text-indigo-950 dark:text-indigo-100">{t('visualizations')}</h2>
          <p className="text-sm text-muted-foreground">{t('explore_demographic_trends')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder={t('select_region')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('national_overview')}</SelectItem>
              <SelectItem value="N'Djamena">N'Djamena</SelectItem>
              <SelectItem value="Logone Occidental">Logone Occidental</SelectItem>
              <SelectItem value="Mayo-Kebbi Est">Mayo-Kebbi Est</SelectItem>
              <SelectItem value="Salamat">Salamat</SelectItem>
              <SelectItem value="Tibesti">Tibesti</SelectItem>
            </SelectContent>
          </Select>
          <Select value={yearRange} onValueChange={setYearRange}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">2000 - 2035</SelectItem>
              <SelectItem value="10y">Last 10 Years</SelectItem>
              <SelectItem value="5y">Last 5 Years</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 800); }}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-50 flex items-center justify-center rounded-xl">
            <RefreshCw className="h-10 w-10 animate-spin text-primary" />
          </div>
        )}

        {/* Row 1: Demographic Row */}
        <div className="h-[300px]">
          <PopulationChart data={populationData} />
        </div>
        <div className="h-[300px]">
          <GDPChart data={gdpData} />
        </div>
        <div className="h-[300px]">
          <AgeDistributionChart data={ageData} />
        </div>

        {/* Row 2: Economic/Employment */}
        <div className="lg:col-span-3 h-[350px]">
          <EmploymentChart data={employmentData} />
        </div>
      </div>

    </div>
  );
};

export default VisualizationDashboard;
