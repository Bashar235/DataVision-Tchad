import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, Download, Loader2, Globe, Shield, BarChart3, Activity, CheckCircle2, RefreshCw } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
// Note: maxAbsValue will be defined inside the component using useMemo.


import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { generateAnalystReport, recordActivityEvent, getRegions, getDatasets, getAnalystPyramid } from "@/services/api";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NamingModal from "@/components/modals/NamingModal";
import { downloadFile } from "@/utils/fileUtils";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

const PROVINCES_CHAD = [
  "National", "Barh el Gazel", "Batha", "Borkou", "Chari-Baguirmi", "Ennedi Est", "Ennedi Ouest",
  "Guéra", "Hadjer-Lamis", "Kanem", "Lac", "Logone Occidental", "Logone Oriental",
  "Mandoul", "Mayo-Kebbi Est", "Mayo-Kebbi Ouest", "Moyen-Chari", "N'Djamena",
  "Ouaddaï", "Salamat", "Sila", "Tandjilé", "Tibesti", "Wadi Fira"
];

const GenerateReport = () => {
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();
  const { id: datasetIdFromUrl } = useParams<{ id: string }>();
  
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(["National"]);
  const [regions, setRegions] = useState<string[]>(["National"]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>(datasetIdFromUrl || "latest");
  const [language, setLanguage] = useState<"en" | "fr" | "ar">("fr");
  const [includeWatermark, setIncludeWatermark] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>([
    "executive_summary",
    "pyramid",
    "trends",
    "health_audit"
  ]);
  const [isNamingOpen, setIsNamingOpen] = useState(false);

  // Pyramid Preview State
  const [pyramidData, setPyramidData] = useState<any[]>([]);
  const [loadingPyramid, setLoadingPyramid] = useState(false);
  // Compute max absolute value for symmetric axis
  const maxAbsValue = useMemo(() => {
    if (!pyramidData.length) return 0;
    return Math.max(...pyramidData.map(d => Math.max(Math.abs(d.male ?? 0), Math.abs(d.female ?? 0))));
  }, [pyramidData]);


  const sections = [
    { id: "executive_summary", label: t('reports_executive_summary_label', {}, "Résumé Analytique"), icon: <FileText className="w-4 h-4" />, desc: t('reports_executive_summary_desc', {}, "Génération automatique basée sur le Quality Gate (95%).") },
    { id: "pyramid", label: t('reports_demographic_pyramids_label', {}, "Pyramides Démographiques"), icon: <BarChart3 className="w-4 h-4" />, desc: t('reports_demographic_pyramids_desc', {}, "Distribution par âge et sexe pour la région sélectionnée.") },
    { id: "trends", label: t('reports_predictive_trends_label', {}, "Tendances Prédictives 2050"), icon: <Globe className="w-4 h-4" />, desc: t('reports_predictive_trends_desc', {}, "Projections ML (LSTM/XGBoost) à long terme.") },
    { id: "health_audit", label: t('reports_health_audit_label', {}, "Audit de Santé des Données"), icon: <Activity className="w-4 h-4" />, desc: t('reports_health_audit_desc', {}, "Preuve de nettoyage et détection d'anomalies.") },
  ];

  const toggleSection = (id: string) => {
    setSelectedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
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

  useEffect(() => {
    const loadData = async () => {
      try {
        const [fetchedRegions, fetchedDatasets] = await Promise.all([
          getRegions(),
          getDatasets()
        ]);
        setRegions(["National", ...fetchedRegions]);
        // Filter for cleaned datasets
        setDatasets(fetchedDatasets.filter((d: any) => d.status === "Cleaned" || d.status === "Published"));
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedSections.includes("pyramid")) {
      const fetchPyramid = async () => {
        setLoadingPyramid(true);
        try {
          // Pass first selected region or Tchad if National, and hardcode year for now (e.g., 2025)
          const regionToFetch = selectedRegions.includes("National") ? "Tchad" : selectedRegions[0];
          const data = await getAnalystPyramid(regionToFetch, 2025);
            const raw = data.pyramid_data || [];
            // Filter out aggregate rows (e.g., containing "ans" or wide ranges like "15-49")
            const filtered = raw.filter((d: any) => {
              const age = d.age?.toString() ?? "";
              return !(age.includes("ans") || age.includes("15-49"));
            });
            // Ensure required age groups exist
            const requiredAges = ["0-4", "5-9", "10-14"];
            requiredAges.forEach((age) => {
              if (!filtered.some((d: any) => d.age === age)) {
                filtered.push({ age, male: 0, female: 0 });
              }
            });
            // Ensure male values are negative for mirroring and female positive
            const processed = filtered.map((d: any) => ({
              ...d,
              male: -Math.abs(d.male ?? 0),
              female: Math.abs(d.female ?? 0),
            }));
            setPyramidData(processed);
        } catch (err) {
          console.error("Failed to load pyramid data:", err);
          setPyramidData([]);
        } finally {
          setLoadingPyramid(false);
        }
      };
      fetchPyramid();
    }
  }, [selectedRegions, selectedSections]);

  const handleGenerateClick = () => {
    if (selectedSections.length === 0) {
      toast({ variant: "destructive", title: t('reports_selection_required_title', {}, "Sélection Requise"), description: t('reports_selection_required_desc', {}, "Veuillez sélectionner au moins une section pour le rapport.") });
      return;
    }
    setIsNamingOpen(true);
  };

  const onNamingConfirm = async (customFilename: string) => {
    setGenerating(true);
    setProgress(10);

    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? prev : prev + 5));
    }, 400);

    try {
      const blob = await generateAnalystReport({
        template: "custom_builder",
        sections: selectedSections,
        region: selectedRegions[0], // Legacy (first selected)
        regions: selectedRegions.includes("National") ? undefined : selectedRegions,
        format: "pdf",
        language: language,
        includeWatermark: includeWatermark,
        customFilename: customFilename,
        dataset_id: selectedDataset === "latest" ? undefined : selectedDataset
      });

      clearInterval(interval);
      setProgress(100);

      const finalFilename = customFilename.toLowerCase().endsWith(".pdf") ? customFilename : `${customFilename}.pdf`;
      downloadFile(blob, finalFilename);
      
      recordActivityEvent('report', { 
        action: 'GENERATE_CUSTOM_REPORT', 
        details: { filename: finalFilename, regions: selectedRegions, format: "pdf", sections: selectedSections, dataset_id: selectedDataset } 
      });

      toast({
        title: t('reports_generated_title', {}, "Rapport Généré"),
        description: t('reports_generated_desc_full', {}, `Le rapport pour ${selectedRegions.join(", ")} a été créé avec succès.`),
      });
    } catch (error) {
      clearInterval(interval);
      console.error("Report generation failed", error);
      toast({
        variant: "destructive",
        title: t('reports_generation_failed_title', {}, "Échec de Génération"),
        description: t('reports_generation_failed_desc', {}, "Une erreur est survenue lors de la création du rapport."),
      });
    } finally {
      setTimeout(() => {
        setGenerating(false);
        setProgress(0);
        setIsNamingOpen(false);
      }, 1000);
    }
  };

  return (
    <div className={`max-w-6xl mx-auto space-y-6 mt-6 pb-20 ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div className="text-start">
          <h1 className="text-3xl font-bold text-foreground">{t('gen_rep_title', {}, 'Générateur de Rapports Personnalisés')}</h1>
          <p className="text-muted-foreground">{t('gen_rep_subtitle', {}, 'Configurez et exportez des analyses certifiées INSEED Tchad.')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg mr-2">
             <Button variant={language === 'en' ? 'secondary' : 'ghost'} size="sm" onClick={() => setLanguage('en')} className="h-8 px-2">🇬🇧 EN</Button>
             <Button variant={language === 'fr' ? 'secondary' : 'ghost'} size="sm" onClick={() => setLanguage('fr')} className="h-8 px-2">🇫🇷 FR</Button>
             <Button variant={language === 'ar' ? 'secondary' : 'ghost'} size="sm" onClick={() => setLanguage('ar')} className="h-8 px-2">🇹🇩 AR</Button>
          </div>
          <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20 flex gap-2">
            <Shield className="w-3.5 h-3.5" />
            {t('gen_rep_cert_badge', {}, 'Certifié DataVision AI')}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Configuration */}
        <Card className="lg:col-span-2 border-primary/10">
          <CardHeader className="text-start border-b border-primary/5 pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              {t('gen_rep_section_title', {}, 'Sélection des Sections')}
            </CardTitle>
            <CardDescription>{t('gen_rep_section_desc', {}, 'Choisissez les composants à inclure dans votre document final.')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
              <div className="space-y-2 text-start">
                <Label className="text-xs font-bold uppercase text-muted-foreground">{t('gen_rep_dataset_source', {}, 'Source des Données')}</Label>
                <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                  <SelectTrigger className="w-full h-11 border-primary/20">
                    <SelectValue placeholder={t('gen_rep_select_dataset', {}, 'Sélectionner un dataset')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">{t('gen_rep_latest_cleaned', {}, 'Dernières Données Nettoyées (Global)')}</SelectItem>
                    {datasets.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.filename} ({new Date(d.uploaded_at).toLocaleDateString()})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 text-start">
                <Label className="text-xs font-bold uppercase text-muted-foreground">{t('gen_rep_regional_focus', {}, 'Focus Régional')}</Label>
                <ScrollArea className="h-44 w-full border border-primary/20 rounded-md p-3 bg-card">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {regions.map(r => (
                      <div key={r} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`region-${r}`} 
                          checked={selectedRegions.includes(r)} 
                          onCheckedChange={() => toggleRegion(r)} 
                          className="border-primary/40"
                        />
                        <Label htmlFor={`region-${r}`} className="text-sm cursor-pointer hover:text-primary transition-colors">{r}</Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-[10px] text-muted-foreground italic mt-1">
                   {selectedRegions.includes("National") ? t('gen_rep_national_desc', {}, "* Mode National activé") : `${selectedRegions.length} ${t('gen_rep_regions_selected', {}, "régions sélectionnées")}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section) => (
                <div 
                  key={section.id} 
                  onClick={() => toggleSection(section.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex gap-4 items-start ${
                    selectedSections.includes(section.id) 
                    ? 'border-primary bg-primary/5 shadow-sm' 
                    : 'border-muted hover:border-primary/30 bg-card'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${selectedSections.includes(section.id) ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    {section.icon}
                  </div>
                  <div className="text-start">
                    <Label className="font-semibold cursor-pointer block mb-1">{section.label}</Label>
                    <p className="text-xs text-muted-foreground leading-relaxed">{section.desc}</p>
                  </div>
                  <div className="ml-auto">
                    <Checkbox checked={selectedSections.includes(section.id)} onCheckedChange={() => {}} />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 space-y-4">
              <div className="flex justify-between items-center p-4 rounded-xl bg-muted/30 border border-muted">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-orange-500" />
                  <div className="text-start">
                    <Label className="font-medium">{t('gen_rep_watermark_label', {}, 'Filigrane "Confidentiel"')}</Label>
                    <p className="text-xs text-muted-foreground">{t('gen_rep_watermark_desc', {}, 'Ajouter un marquage de sécurité sur toutes les pages.')}</p>
                  </div>
                </div>
                <Switch checked={includeWatermark} onCheckedChange={setIncludeWatermark} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Region & Summary */}
        <div className="space-y-6">
          <Card className="border-primary/10">
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-start space-y-4">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <FileText className="w-4 h-4" />
                   </div>
                   <h4 className="text-sm font-bold text-slate-800">{t('gen_rep_summary_title', {}, 'Résumé de Configuration')}</h4>
                </div>
                
                <ul className="text-xs space-y-2.5 text-muted-foreground ml-1">
                  <li className="flex justify-between border-b border-slate-200/50 pb-2">
                    <span>{t('gen_rep_summary_region', {}, 'Région:')}</span>
                    <span className="text-foreground font-bold truncate max-w-[120px]">
                      {selectedRegions.includes("National") ? "National" : selectedRegions.length === 1 ? selectedRegions[0] : `${selectedRegions.length} Régions`}
                    </span>
                  </li>
                  <li className="flex justify-between border-b border-slate-200/50 pb-2">
                    <span>{t('gen_rep_summary_dataset', {}, 'Dataset:')}</span>
                    <span className="text-foreground font-bold truncate max-w-[120px]">
                      {selectedDataset === "latest" ? t('common_latest', {}, "Dernier") : datasets.find(d => d.id === selectedDataset)?.filename || "ID: " + selectedDataset.slice(0,8)}
                    </span>
                  </li>
                  <li className="flex justify-between border-b border-slate-200/50 pb-2">
                    <span>{t('gen_rep_summary_sections', {}, 'Sections:')}</span>
                    <span className="text-foreground font-bold">{selectedSections.length}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{t('gen_rep_summary_security', {}, 'Sécurité:')}</span>
                    <span className={`font-bold ${includeWatermark ? 'text-orange-600' : 'text-foreground'}`}>
                      {includeWatermark ? t('gen_rep_summary_active_mark', {}, 'Marquage Actif') : t('gen_rep_summary_standard', {}, 'Standard')}
                    </span>
                  </li>
                </ul>
              </div>

              {generating ? (
                <div className="space-y-2 py-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="animate-pulse flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t('gen_rep_generating', {}, 'Génération en cours...')}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              ) : (
                <Button className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" onClick={handleGenerateClick}>
                  <FileText className="w-5 h-5 mr-2" />
                  {t('gen_rep_generate_btn', {}, 'Générer Rapport PDF')}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white border-white/10 dark:bg-slate-950">
             <CardContent className="pt-6 text-start space-y-4">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                 </div>
                 <div>
                   <h3 className="font-bold text-sm">{t('gen_rep_ready_publish', {}, 'Prêt pour Publication')}</h3>
                   <p className="text-[10px] text-zinc-400 uppercase tracking-widest">{t('gen_rep_standards', {}, 'Standards INSEED 2024')}</p>
                 </div>
               </div>
               <p className="text-xs text-zinc-400 leading-relaxed italic">
                 {t('gen_rep_disclaimer', {}, '"Ce générateur utilise les modèles LSTM & XGBoost pour projeter les tendances jusqu\'en 2050, sous réserve d\'un score de qualité > 95%."')}
               </p>
             </CardContent>
          </Card>

          {/* Demographic Pyramid Preview */}
          {selectedSections.includes("pyramid") && (
            <Card className="border-primary/20 bg-card overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-primary/10 p-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  {t('pyramid_preview', {}, 'Aperçu de la Pyramide')}
                  {loadingPyramid && <Loader2 className="w-3 h-3 animate-spin ml-auto text-primary" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex items-center justify-center min-h-[250px]">
                {loadingPyramid ? (
                   <div className="flex flex-col items-center justify-center space-y-2 opacity-50">
                     <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                     <span className="text-xs">{t('loading_data', {}, 'Chargement...')}</span>
                   </div>
                ) : pyramidData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      layout="vertical"
                      data={pyramidData}
                      margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                      stackOffset="sign"
                      barCategoryGap="20%"
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.1} />
                      <XAxis type="number" domain={[-maxAbsValue, maxAbsValue]} hide />
                      <YAxis
                        dataKey="age"
                        type="category"
                        width={40}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        orientation={isRtl ? 'right' : 'left'}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
                      />
                      <RechartsTooltip
                        cursor={{ fill: 'hsl(var(--primary)/0.05)' }}
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.98)",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                          fontSize: "12px",
                          textAlign: isRtl ? 'right' : 'left',
                          zIndex: 100,
                        }}
                        formatter={(value: number, name: string) => {
                          const absValue = Math.abs(value);
                          const formattedValue = absValue >= 1000000 ? `${(absValue / 1000000).toFixed(2)}M` : absValue.toLocaleString();
                          const label = name === "male" ? t('male', {}, 'Hommes') : t('female', {}, 'Femmes');
                          return [formattedValue, label];
                        }}
                        labelStyle={{ fontWeight: 800, color: 'hsl(var(--foreground))', marginBottom: '4px' }}
                      />
                      <Bar dataKey="male" name="male" fill="#3b82f6" radius={isRtl ? [4, 0, 0, 4] : [0, 4, 4, 0]} stackId="stack" barSize={10} />
                      <Bar dataKey="female" name="female" fill="#ec4899" radius={isRtl ? [0, 4, 4, 0] : [4, 0, 0, 4]} stackId="stack" barSize={10} />
                      <Legend wrapperStyle={{ fontSize: "12px" }} formatter={(value) => value === "male" ? t('male', {}, 'Hommes') : t('female', {}, 'Femmes')} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-xs text-muted-foreground">
                    {t('no_data_pyramid', {}, 'Données insuffisantes pour cet aperçu.')}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      <NamingModal
        isOpen={isNamingOpen}
        onClose={() => setIsNamingOpen(false)}
        onConfirm={onNamingConfirm}
        defaultFilename={`Rapport_${selectedRegions[0]}_${new Date().toISOString().split('T')[0]}`}
      />
    </div>
  );
};

export default GenerateReport;
