import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, Users, TrendingUp, FileText, Database } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

const Overview = () => {
  const { t, isRtl } = useLanguage();

  const stats = [
    { title: t('total_population'), value: "17.2M", change: "+2.8%", icon: Users, color: "text-chart-1" },
    { title: t('datasets'), value: "847", change: "+12", icon: Database, color: "text-chart-2" },
    { title: t('reports'), value: "234", change: "+18%", icon: FileText, color: "text-chart-3" },
    { title: t('accuracy'), value: "94.7%", change: "+1.2%", icon: TrendingUp, color: "text-chart-4" },
  ];

  const populationData = [
    { year: "2018", population: 15.5 },
    { year: "2019", population: 15.9 },
    { year: "2020", population: 16.4 },
    { year: "2021", population: 16.8 },
    { year: "2022", population: 17.2 },
    { year: "2023", population: 17.6 },
  ];

  const regionData = [
    { name: "N'Djamena", value: 1.5 },
    { name: "Logone Occidental", value: 0.8 },
    { name: "Mayo-Kebbi Est", value: 0.9 },
    { name: "Ouaddaï", value: 0.7 },
    { name: t('others'), value: 13.3 },
  ];

  const employmentData = [
    { sector: t('reports_agriculture'), value: 45 },
    { sector: t('reports_services'), value: 30 },
    { sector: t('reports_industry'), value: 15 },
    { sector: t('others'), value: 10 },
  ];

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  return (
    <div className="space-y-6">
      <div className="text-start">
        <h1 className="text-3xl font-bold mb-2">{t('side_nav_overview')}</h1>
        <p className="text-muted-foreground">
          {t('dashboard_inseed_platform')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className={`flex flex-row items-center justify-between pb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CardTitle className="text-sm font-medium text-muted-foreground text-start">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent className="text-start">
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className={`text-xs text-muted-foreground flex items-center gap-1 mt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <ArrowUpRight className={`h-3 w-3 text-success ${isRtl ? 'rotate-[-90deg]' : ''}`} />
                {stat.change} {t('from_last_year')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="text-start">
            <CardTitle>{t('population_growth_trend')}</CardTitle>
            <CardDescription>{t('historical_population_data')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={populationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" reversed={isRtl} />
                <YAxis stroke="hsl(var(--muted-foreground))" orientation={isRtl ? 'right' : 'left'} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", textAlign: isRtl ? 'right' : 'left' }} />
                <Line type="monotone" dataKey="population" stroke="hsl(var(--chart-1))" strokeWidth={3} dot={{ fill: "hsl(var(--chart-1))", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-start">
            <CardTitle>{t('regional_distribution')}</CardTitle>
            <CardDescription>{t('population_by_region')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={regionData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                  {regionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", textAlign: isRtl ? 'right' : 'left' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="text-start">
            <CardTitle>{t('employment_by_sector')}</CardTitle>
            <CardDescription>{t('labor_force_distribution')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={employmentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="sector" stroke="hsl(var(--muted-foreground))" reversed={isRtl} />
                <YAxis stroke="hsl(var(--muted-foreground))" orientation={isRtl ? 'right' : 'left'} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", textAlign: isRtl ? 'right' : 'left' }} />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('recent_activity')}</CardTitle>
          <CardDescription>{t('recent_actions')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { action: t('overview_census_uploaded'), dataset: "Population Survey 2023", time: `2 ${t('overview_hours_ago')}` },
              { action: t('overview_forecast_updated'), dataset: "Fertility Rate Predictions", time: `5 ${t('overview_hours_ago')}` },
              { action: t('side_nav_generate_report'), dataset: "Q4 2023 Demographic Report", time: `1 ${t('overview_day_ago')}` },
              { action: t('side_nav_database'), dataset: "Employment Statistics", time: `2 ${t('overview_days_ago')}` },
            ].map((activity, index) => (
              <div key={index} className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="text-start">
                  <p className="font-medium">{activity.action}</p>
                  <p className="text-sm text-muted-foreground">{activity.dataset}</p>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Overview;
