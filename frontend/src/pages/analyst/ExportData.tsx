import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, Loader2, Calendar } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { adminExport, recordActivityEvent, getActivityTimeline, getCleanedPreview, exportFilteredData, getDatasets, getRegions, exportCleanedData } from "@/services/api";
import NamingModal from "@/components/modals/NamingModal";
import { downloadFile } from "@/utils/fileUtils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const ExportData = () => {
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();
  const { id: datasetIdFromUrl } = useParams<{ id: string }>();

  const [format, setFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);
  const [isNamingOpen, setIsNamingOpen] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(["National"]);
  const [startYear, setStartYear] = useState<number>(2009);
  const [endYear, setEndYear] = useState<number>(2024);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>(datasetIdFromUrl || "latest");
  const [selectedIndicator, setSelectedIndicator] = useState<string>("All"); // Legacy support
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<{ headers: string[], data: any[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [regions, setRegions] = useState<string[]>(["National"]);

  const columnOptions = [
    { id: "Population", label: t('col_label_population') },
    { id: "Fertility", label: t('col_label_isf') },
    { id: "Mortality", label: t('col_label_tmi') },
    { id: "Urbanization", label: t('col_label_urbanization') },
    { id: "GDP", label: t('col_label_gdp') }
  ];

  const fetchHistory = useCallback(async () => {
    try {
      const timeline = await getActivityTimeline();
      // Filter for EXPORT_DATA actions
      const exportHistory = timeline.filter((item: any) => item.action === "EXPORT_DATA");
      setHistory(exportHistory);
    } catch (error) {
      console.error("Failed to fetch history", error);
    }
  }, []);

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const data = await getCleanedPreview({
        regions: selectedRegions.includes("National") ? undefined : selectedRegions,
        start_year: startYear,
        end_year: endYear,
        indicator: selectedIndicator === "All" ? undefined : selectedIndicator,
        dataset_id: selectedDataset === "latest" ? undefined : selectedDataset
      });
      setPreviewData(data);
    } catch (error) {
      console.error("Preview failed", error);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedRegions, selectedIndicator, selectedDataset, startYear, endYear]);

  useEffect(() => {
    fetchHistory();
    fetchPreview();
    
    // Fetch regions and datasets dynamically
    const loadData = async () => {
      try {
        const [fetchedRegions, fetchedDatasets] = await Promise.all([
          getRegions(),
          getDatasets()
        ]);
        setRegions(["National", ...fetchedRegions]);
        setDatasets(fetchedDatasets.filter((d: any) => d.status === "Cleaned" || d.status === "Published"));
      } catch (err) {
        console.error("Failed to fetch lookup data", err);
      }
    };
    loadData();
  }, [fetchHistory, fetchPreview]);

  const handleExportClick = () => {
    setIsNamingOpen(true);
  };

  const toggleColumn = (colId: string) => {
    setSelectedColumns(prev => 
      prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
    );
  };

  const toggleRegion = (region: string) => {
    setSelectedRegions(prev => {
      if (region === "National") return ["National"];
      const filtered = prev.filter(r => r !== "National");
      if (filtered.includes(region)) {
        const next = filtered.filter(r => r !== region);
        return next.length === 0 ? ["National"] : next;
      }
      return [...filtered, region];
    });
  };

  const onNamingConfirm = async (customFilename: string) => {
    setExporting(true);
    try {
      const blob = await exportFilteredData(
        format,
        selectedDataset === "latest" ? undefined : selectedDataset,
        undefined, // single region (legacy)
        selectedColumns.length > 0 ? selectedColumns : undefined,
        customFilename,
        selectedRegions.includes("National") ? undefined : selectedRegions,
        startYear,
        endYear
      );

      const extension = format === 'excel' ? 'xlsx' : format;
      const finalFilename = customFilename.toLowerCase().endsWith(`.${extension}`)
        ? customFilename
        : `${customFilename}.${extension}`;

      downloadFile(blob, finalFilename);
      
      recordActivityEvent('export', { 
        action: 'EXPORT_DATA', 
        details: { 
            filename: finalFilename, 
            regions: selectedRegions, 
            start_year: startYear,
            end_year: endYear,
            format, 
            columns: selectedColumns,
            dataset_id: selectedDataset
        } 
      });

      toast({
        title: t('export_started'),
        description: `${t('export_traceability')} (${format.toUpperCase()})`,
      });
      fetchHistory(); // Refresh history
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

  const handleReDownload = async (logItem: any) => {
    try {
      let details = logItem.details || {};
      if (typeof logItem.details === 'string') {
        details = JSON.parse(logItem.details);
      }
      
      toast({ title: t('common_export'), description: t('export_regenerating') });
      const blob = await exportCleanedData({
        format: details.format || 'csv',
        region: details.region,
        indicator: details.indicator,
        year: details.year
      });
      downloadFile(blob, details.filename || `re_export_${Date.now()}.csv`);
    } catch (error) {
      toast({ variant: "destructive", title: t("common_error"), description: t('export_redownload_failed') });
    }
  };


  return (
    <div className={`max-w-7xl mx-auto space-y-6 mt-4 ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="text-start">
        <h1 className="text-2xl font-bold text-foreground">{t('side_nav_export_data')}</h1>
        <p className="text-muted-foreground">{t('export_traceability')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="text-start">
            <CardTitle>{t('data_export_control')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-start">
            <div className="space-y-2">
              <Label>{t('common_format') || 'Format'}</Label>
              <Tabs value={format} onValueChange={setFormat} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="csv">CSV</TabsTrigger>
                  <TabsTrigger value="excel">Excel</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">{t('gen_rep_dataset_source', {}, 'Source des Données')}</Label>
                <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('gen_rep_select_dataset', {}, 'Sélectionner un dataset')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">{t('gen_rep_latest_cleaned', {}, 'Dernières Données Nettoyées')}</SelectItem>
                    {datasets.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.filename}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">{t('export_regions_label', {}, 'Régions à Exporter')}</Label>
                <ScrollArea className="h-40 w-full border rounded-md p-2">
                  <div className="space-y-2">
                    {regions.map(r => (
                      <div key={r} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`region-${r}`} 
                          checked={selectedRegions.includes(r)} 
                          onCheckedChange={() => toggleRegion(r)} 
                        />
                        <Label htmlFor={`region-${r}`} className="text-sm cursor-pointer">{r}</Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">{t('common_start_year', {}, 'Année Début')}</Label>
                  <Input 
                    type="number" 
                    value={startYear} 
                    onChange={(e) => setStartYear(parseInt(e.target.value))} 
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">{t('common_end_year', {}, 'Année Fin')}</Label>
                  <Input 
                    type="number" 
                    value={endYear} 
                    onChange={(e) => setEndYear(parseInt(e.target.value))} 
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">{t('export_columns_label', {}, 'Colonnes à Exporter')}</Label>
                <div className="grid grid-cols-1 gap-2">
                  {columnOptions.map((col) => (
                    <div 
                      key={col.id} 
                      className={`flex items-center space-x-2 p-2 rounded-md border transition-colors cursor-pointer ${selectedColumns.includes(col.id) ? 'bg-primary/5 border-primary/30' : 'border-transparent hover:bg-muted'}`}
                      onClick={() => toggleColumn(col.id)}
                    >
                      <Checkbox 
                        id={col.id} 
                        checked={selectedColumns.includes(col.id)} 
                        onCheckedChange={() => {}} // Handled by div click
                      />
                      <label
                        htmlFor={col.id}
                        className="text-sm font-medium leading-none cursor-pointer flex-1"
                      >
                        {col.label}
                      </label>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground italic mt-1">
                    {selectedColumns.length === 0 ? t('export_all_cols_desc', {}, "* Si rien n'est coché, toutes les colonnes seront exportées.") : `${selectedColumns.length} ${t('export_cols_selected_desc', {}, "colonnes sélectionnées.")}`}
                  </p>
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={handleExportClick} disabled={exporting}>
              {exporting ? <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} /> : <Download className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />}
              {t('side_nav_export_data')}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="text-start flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('export_preview_title')}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedRegions.length} {t('export_regions_selected', {}, 'région(s)')} • {startYear}-{endYear} • {selectedIndicator}
              </p>
            </div>
            {previewLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[300px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewData?.headers.map(h => (
                        <TableHead key={h} className="text-[10px] uppercase font-bold whitespace-nowrap">
                          {h.replace('_', ' ')}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData?.data.map((row, i) => (
                      <TableRow key={i}>
                        {previewData.headers.map(h => (
                          <TableCell key={h} className="text-xs py-2 whitespace-nowrap">
                            {typeof row[h] === 'number' ? row[h].toLocaleString() : row[h]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {(!previewData || previewData.data.length === 0) && !previewLoading && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          {t('export_no_records')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="text-start">
          <CardTitle>{t('reports_history')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {history.length > 0 ? history.map((export_item, index) => {
               let details = export_item.details || {};
               try {
                 if (typeof export_item.details === 'string') {
                   details = JSON.parse(export_item.details);
                 }
               } catch(e) {}
               
               return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border border-border rounded-lg text-start group hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/5 rounded-full group-hover:bg-primary/10 transition-colors">
                      <FileSpreadsheet className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {details.filename || "export_data.csv"}
                        </p>
                        <Badge variant="secondary" className="text-[10px]">
                          {details.format?.toUpperCase() || "CSV"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(export_item.timestamp).toLocaleString()} • {details.region || 'National'} / {details.indicator || 'All'}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleReDownload(export_item)} className="hover:bg-primary/10 hover:text-primary">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
               );
            }) : (
              <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                {t('export_no_recent')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <NamingModal
        isOpen={isNamingOpen}
        onClose={() => setIsNamingOpen(false)}
        onConfirm={onNamingConfirm}
        defaultFilename={`${selectedIndicator === 'All' ? 'indicators' : selectedIndicator.toLowerCase().replace(/ /g, '_')}_${selectedRegions[0].toLowerCase()}_${new Date().toISOString().split('T')[0]}`}
      />
    </div>
  );
};

export default ExportData;
