/**
 * Analyst Map Page
 * 
 * Route: /analyst/maps
 * Mode: Audit (Quality Gate)
 */
import { useState } from "react";
import ChadMap from "@/components/maps/ChadMap";
import MapLegend from "@/components/maps/MapLegend";
import ProvinceDetails from "@/components/maps/ProvinceDetails";
import { useLanguage } from "@/contexts/LanguageContext";

const AnalystMaps = () => {
    const { t, isRtl } = useLanguage();
    const [selectedStats, setSelectedStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(2050);

    return (
        <div className={`flex-1 flex overflow-hidden ${isRtl ? 'flex-row-reverse' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Column 2: Map area - Now Full Bleed */}
            <div className="flex-1 relative bg-slate-50">
                <ChadMap
                    mode="audit"
                    year={selectedYear}
                    onStatsUpdate={setSelectedStats}
                    onLoadingChange={setIsLoading}
                />
            </div>

            {/* Data Rail - Column 3: Fixed Right Sidebar */}
            <div className="w-[380px] shrink-0 h-full overflow-y-auto bg-white border-l border-slate-200 z-10 flex flex-col">
                <div className="p-6 flex flex-col gap-6 flex-1">
                    {/* Header Card */}
                    <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100/80">
                        <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-1">{t('maps')}</h1>
                        <p className="text-slate-500 text-sm font-medium">{t('click_province')}</p>
                    </div>

                    {/* Legend Card */}
                    <MapLegend
                        mode="audit"
                        className="bg-white border border-slate-100 rounded-2xl shadow-sm"
                    />

                    {/* Province Details Card (Dynamic) */}
                    <ProvinceDetails
                        stats={selectedStats}
                        loading={isLoading}
                        mode="audit"
                    />

                    {!selectedStats && !isLoading && (
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 mt-auto">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                {t('audit_status_title')}
                            </h3>
                            <div className="space-y-4 text-xs text-slate-500 leading-relaxed font-medium">
                                <p>{t('quality_gate_text')}</p>
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-800">
                                    <span className="font-bold block mb-1">{t('attention_label')}</span>
                                    <span>{t('amber_warning')}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalystMaps;
