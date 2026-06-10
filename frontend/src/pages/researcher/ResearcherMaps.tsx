/**
 * Researcher Map Page
 * 
 * Route: /researcher/maps
 * Mode: Insight (Demographics)
 */
import { useState } from "react";
import ChadMap from "@/components/maps/ChadMap";
import MapLegend from "@/components/maps/MapLegend";
import ProvinceDetails from "@/components/maps/ProvinceDetails";
import { useOutletContext } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const ResearcherMaps = () => {
    const { t, isRtl } = useLanguage();
    const { isSidebarHovered } = useOutletContext<{ isSidebarHovered: boolean }>();
    const [selectedStats, setSelectedStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    return (
        <div className="h-full w-full relative overflow-hidden flex bg-white">
            {/* Map Area - Column 2: Now Full Bleed */}
            <div className="flex-1 relative h-full">
                <ChadMap
                    mode="insight"
                    disableInteraction={isSidebarHovered}
                    onStatsUpdate={setSelectedStats}
                    onLoadingChange={setIsLoading}
                />
            </div>

            {/* Data Rail - Column 3: Fixed Right Sidebar */}
            <div className={`w-[380px] shrink-0 h-full overflow-y-auto bg-white border-s border-slate-200 z-10 flex flex-col`}>
                <div className="p-6 flex flex-col gap-6 flex-1">
                    {/* Header Card */}
                    <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100/80">
                        <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-1">{t('maps')}</h1>
                        <p className="text-slate-500 text-sm font-medium">{t('click_province')}</p>
                    </div>

                    {/* Legend Card */}
                    <MapLegend
                        mode="insight"
                        className="bg-white border border-slate-100 rounded-2xl shadow-sm"
                    />

                    {/* Province Details Card (Dynamic) */}
                    <ProvinceDetails
                        stats={selectedStats}
                        loading={isLoading}
                        mode="insight"
                    />

                    {/* Source Info - Optional footer */}
                    {!selectedStats && !isLoading && (
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3 mt-auto">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                {t('data_source')}
                            </h3>
                            <div className="text-xs text-slate-500 leading-relaxed font-medium">
                                {t('population_projections')}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResearcherMaps;
