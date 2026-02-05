import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PopulationChart from "@/components/dashboard/charts/PopulationChart";
import EmploymentChart from "@/components/dashboard/charts/EmploymentChart";
import AgeDistributionChart from "@/components/dashboard/charts/AgeDistributionChart";
import GDPChart from "@/components/dashboard/charts/GDPChart";
import { useState } from "react";

import { getResearchTrends } from "@/services/api";
import { useEffect } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";

const Visualizations = () => {
  const { t, isRtl } = useLanguage();
  const [indicator, setIndicator] = useState("population");
  const [region, setRegion] = useState("all");
  const [year, setYear] = useState("2023");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await getResearchTrends(region === "all" ? null : region);
        setData(result.data || []);
      } catch (error) {
        console.error("Failed to fetch analyst data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [region]);

  // Transform Data
  const currentYearRecords = data.filter((d: any) => d.year === Number(year));

  const aggregatedStats = currentYearRecords.reduce((acc: any, curr: any) => {
    acc.count = (acc.count || 0) + 1;
    acc.emp_agri = (acc.emp_agri || 0) + curr.employment_agriculture;
    acc.emp_ind = (acc.emp_ind || 0) + curr.employment_industry;
    acc.emp_serv = (acc.emp_serv || 0) + curr.employment_services;
    acc.age_0_14 = (acc.age_0_14 || 0) + curr.age_0_14;
    acc.age_15_64 = (acc.age_15_64 || 0) + curr.age_15_64;
    acc.age_65_plus = (acc.age_65_plus || 0) + curr.age_65_plus;
    return acc;
  }, { count: 0, emp_agri: 0, emp_ind: 0, emp_serv: 0, age_0_14: 0, age_15_64: 0, age_65_plus: 0 });

  const employmentData = aggregatedStats.count > 0 ? [{
    year: Number(year),
    agriculture: parseFloat((aggregatedStats.emp_agri / aggregatedStats.count).toFixed(1)),
    industry: parseFloat((aggregatedStats.emp_ind / aggregatedStats.count).toFixed(1)),
    services: parseFloat((aggregatedStats.emp_serv / aggregatedStats.count).toFixed(1))
  }] : [];

  const ageData = aggregatedStats.count > 0 ? {
    age014: parseFloat((aggregatedStats.age_0_14 / aggregatedStats.count).toFixed(1)),
    age1564: parseFloat((aggregatedStats.age_15_64 / aggregatedStats.count).toFixed(1)),
    age65plus: parseFloat((aggregatedStats.age_65_plus / aggregatedStats.count).toFixed(1))
  } : undefined;

  const mainPadding = isRtl ? 'pr-[80px]' : 'pl-[80px]';

  return (
    <div className="min-h-screen bg-background">
      <AnalystSidebar />

      <main className={`${mainPadding} p-6 overflow-auto transition-all duration-300`}>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-start">
            <h1 className="text-3xl font-bold text-foreground">{t('interactive_visualizations')}</h1>
            <p className="text-muted-foreground">{t('multi_view_sync')} ({region === 'all' ? t('national') : region})</p>
          </div>

          <Card>
            <CardHeader className="text-start">
              <CardTitle className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span>{t('dynamic_indicator_selector')}</span>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-start">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('indicator')}</label>
                  <Select value={indicator} onValueChange={setIndicator}>
                    <SelectTrigger className="text-start">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="population">{t('total_population')}</SelectItem>
                      <SelectItem value="employment">{t('employment_rate')}</SelectItem>
                      <SelectItem value="gdp">{t('gdp_growth')}</SelectItem>
                      <SelectItem value="fertility">{t('birth_rate')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('regions')}</label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger className="text-start">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_regions')}</SelectItem>
                      <SelectItem value="N'Djamena">{t('region_ndjamena')}</SelectItem>
                      <SelectItem value="Logone Occidental">{t('region_logone_occidental')}</SelectItem>
                      <SelectItem value="Mayo-Kebbi Est">{t('region_mayo_kebbi_est')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('select_years')}</label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="text-start">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['2023', '2024', '2025', '2026', '2027', '2028'].map(y => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PopulationChart />
            <EmploymentChart data={employmentData} />
            <AgeDistributionChart data={ageData} />
            <GDPChart />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Visualizations;
