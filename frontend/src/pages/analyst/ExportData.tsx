import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { adminExport } from "@/services/api";
import NamingModal from "@/components/modals/NamingModal";
import { downloadFile } from "@/utils/fileUtils";

const ExportData = () => {
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();
  const [format, setFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>(["population"]);
  const [isNamingOpen, setIsNamingOpen] = useState(false);

  const tables = [
    { id: "population", label: t('total_population') },
    { id: "employment", label: t('employment_rate') },
    { id: "gdp", label: t('gdp_growth') },
    { id: "demographics", label: t('reports_demographic_overview') },
  ];

  const handleExportClick = () => {
    if (selectedTables.length === 0) {
      toast({
        variant: "destructive",
        title: t('common_warning'),
        description: "Please select at least one table",
      });
      return;
    }
    setIsNamingOpen(true);
  };

  const onNamingConfirm = async (customFilename: string) => {
    setExporting(true);
    try {
      const dataset = selectedTables.join(", ");
      const blob = await adminExport(format, dataset, customFilename);

      const extension = format === 'excel' ? 'xlsx' : format;
      const finalFilename = customFilename.toLowerCase().endsWith(`.${extension}`)
        ? customFilename
        : `${customFilename}.${extension}`;

      downloadFile(blob, finalFilename);

      toast({
        title: t('export_started'),
        description: `${t('export_traceability')} (${format.toUpperCase()})`,
      });
    } catch (error) {
      console.error("Export failed", error);
      toast({
        variant: "destructive",
        title: t('common_error'),
        description: t('upload_error_desc'),
      });
    } finally {
      setExporting(false);
    }
  };

  const mainPadding = isRtl ? 'pr-[80px]' : 'pl-[80px]';

  return (
    <div className="min-h-screen bg-background">
      <AnalystSidebar />

      <main className={`${mainPadding} p-6 overflow-auto transition-all duration-300`}>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-start">
            <h1 className="text-3xl font-bold text-foreground">{t('side_nav_export_data')}</h1>
            <p className="text-muted-foreground">{t('export_traceability')}</p>
          </div>

          <Card>
            <CardHeader className="text-start">
              <CardTitle>{t('data_export_control')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-start">
              <div className="space-y-2">
                <Label>{t('indicator')}</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">{t('common_csv')}</SelectItem>
                    <SelectItem value="excel">{t('common_excel')}</SelectItem>
                    <SelectItem value="json">{t('common_json')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-base">{t('data_table')}</Label>
                {tables.map((table) => (
                  <div key={table.id} className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                    <Checkbox
                      id={table.id}
                      checked={selectedTables.includes(table.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedTables([...selectedTables, table.id]);
                        } else {
                          setSelectedTables(
                            selectedTables.filter((id) => id !== table.id)
                          );
                        }
                      }}
                    />
                    <Label htmlFor={table.id} className="cursor-pointer">
                      {table.label}
                    </Label>
                  </div>
                ))}
              </div>

              <Button className="w-full" onClick={handleExportClick} disabled={exporting}>
                {exporting ? <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} /> : <Download className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />}
                {t('side_nav_export_data')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-start">
              <CardTitle>{t('reports_history')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { file: "population_export_2024-01-15.csv", date: "2024-01-15 14:30" },
                  { file: "employment_data_2024-01-14.xlsx", date: "2024-01-14 09:15" },
                  { file: "gdp_analysis_2024-01-13.json", date: "2024-01-13 16:45" },
                ].map((export_item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-border rounded-lg text-start"
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {export_item.file}
                        </p>
                        <p className="text-xs text-muted-foreground">{export_item.date}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <NamingModal
        isOpen={isNamingOpen}
        onClose={() => setIsNamingOpen(false)}
        onConfirm={onNamingConfirm}
        defaultFilename={`${selectedTables[0] || 'export'}_${new Date().toISOString().split('T')[0]}`}
      />
    </div>
  );
};

export default ExportData;
