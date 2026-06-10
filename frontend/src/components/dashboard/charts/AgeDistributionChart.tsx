import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { RefreshCw, Users, Info } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AgeGroup {
  group: string;
  value: number;
  percentage: number;
}

interface ReproductiveReach {
  value: number;
  percentage: number;
}

interface AgeDistributionChartProps {
  data?: AgeGroup[];
  reproductiveReach?: ReproductiveReach;
}

const AgeDistributionChart = ({ data: inputData, reproductiveReach }: AgeDistributionChartProps) => {
  const { t, isRtl } = useLanguage();
  const [showReproductiveHighlight, setShowReproductiveHighlight] = useState(false);
  
  // Custom mapping for colors to highlight specific groups if needed
  const getBarColor = (group: string) => {
    if (showReproductiveHighlight) {
      // Highlight 15-49 groups in a distinct color if toggle is on
      const age = parseInt(group);
      if (!isNaN(age) && age >= 15 && age <= 45) {
        return "#ec4899"; // Pink for reproductive highlight
      }
    }

    if (group.includes("65") || group.includes("70") || group.includes("75") || group === "80+") {
      return "#6366f1"; // Indigo/Purple for elderly (key indicator)
    }
    if (parseInt(group) < 15) {
      return "#10b981"; // Emerald for youth
    }
    return "#3b82f6"; // Blue for working age
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-t-4 border-t-primary/20 h-full">
      <CardHeader className="text-start pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            {t('age_distribution')}
          </CardTitle>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            {t('national_demographic_pyramid', {}, 'National Demographic Pyramid')}
          </p>
        </div>
        
        {reproductiveReach && (
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant={showReproductiveHighlight ? "default" : "outline"}
                  className={`cursor-pointer transition-all ${showReproductiveHighlight ? "bg-pink-500 hover:bg-pink-600 border-none" : "hover:bg-pink-50 text-pink-600 border-pink-200"}`}
                  onClick={() => setShowReproductiveHighlight(!showReproductiveHighlight)}
                >
                  <Users className="w-3 h-3 mr-1" />
                  {reproductiveReach.percentage}% {t('femmes_15_49_abbr', {}, 'W 15-49')}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px] text-xs">
                <p className="font-bold mb-1">{t('reproductive_health_reach', {}, 'Reproductive Health Reach')}</p>
                <p>{(reproductiveReach.value / 1000000).toFixed(2)}M {t('women_aged_15_49', {}, 'women aged 15-49')}. {t('click_to_highlight', {}, 'Click to highlight in pyramid.')}</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        )}
      </CardHeader>
      <CardContent className="flex items-center justify-center min-h-[300px] pt-4 px-2">
        {(!inputData || inputData.length === 0) ? (
          <div className="flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 text-primary animate-spin opacity-40" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              {t('data_initializing') || "Data Initializing..."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              layout="vertical"
              data={inputData}
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.1} />
              <XAxis 
                type="number" 
                hide 
              />
              <YAxis 
                dataKey="group" 
                type="category" 
                width={60}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                orientation={isRtl ? 'right' : 'left'}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--primary)/0.05)' }}
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.98)",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  fontSize: "12px",
                  textAlign: isRtl ? 'right' : 'left',
                  zIndex: 100
                }}
                formatter={(value: number, name: string, props: any) => {
                  const formattedValue = value >= 1000000 
                    ? `${(value / 1000000).toFixed(2)}M` 
                    : value.toLocaleString();
                  
                  return [
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-foreground">{formattedValue}</span>
                    </div>,
                    ""
                  ];
                }}
                labelStyle={{ fontWeight: 800, color: 'hsl(var(--foreground))', marginBottom: '4px' }}
              />
              <Bar 
                dataKey="value" 
                radius={[0, 4, 4, 0]}
                barSize={12}
                isAnimationActive={true}
                animationDuration={1500}
              >
                {inputData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.group)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
      <div className="px-4 pb-4 flex items-center gap-4 text-[10px] text-muted-foreground font-medium">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#10b981]" /> {t('youth', {}, 'Youth')}
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#3b82f6]" /> {t('working_age', {}, 'Working Age')}
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#6366f1]" /> {t('elderly', {}, 'Elderly (65+)')}
        </div>
      </div>
    </Card>
  );
};

export default AgeDistributionChart;
