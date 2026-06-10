/**
 * Researcher Geospatial Dashboard
 * 
 * Route: /researcher/geospatial
 * Purpose: Insight & Reporting - View demographic data by clicking provinces
 */
import { useState } from 'react';
import { FileText, Download, Calendar, Eye, Loader2 } from "lucide-react";
import ChadMap from '@/components/maps/ChadMap';
import MapLegend from '@/components/maps/MapLegend';
import ProvinceDetails from '@/components/maps/ProvinceDetails';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ResearcherGeospatial() {
    const { t, isRtl } = useLanguage();
    const [selectedStats, setSelectedStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    return (
        <div className="h-full w-full relative overflow-hidden flex bg-white">
            {/* Map Area - Column 2: Now Full Bleed */}
            <div className="flex-1 relative h-full">
                <ChadMap
                    mode="insight"
                    onStatsUpdate={setSelectedStats}
                    onLoadingChange={setIsLoading}
                />
            </div>

            {/* Data Rail - Column 3: Fixed Right Sidebar */}
            <div className="w-[380px] shrink-0 h-full overflow-y-auto bg-white border-s border-slate-200 z-10 flex flex-col">
                <div className="p-6 flex flex-col gap-6 flex-1">
                    {/* Header Card */}
                    <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100/80 text-start">
                        <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-1">
                            {t('geospatial_explorer')}
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">
                            {t('geospatial_description')}
                        </p>
                    </div>

                    {/* Stats Summary Section */}
                    <div className="space-y-4">
                        <h3 className={`text-[10px] font-black text-slate-400 gap-4 uppercase tracking-[0.2em] ${isRtl ? 'text-end' : 'text-start'}`}>
                            {t('overview_stats')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard
                                title={t('total_provinces')}
                                value="23"
                                icon="🗺️"
                                color="blue"
                                isRtl={isRtl}
                            />
                            <StatCard
                                title={t('total_population')}
                                value={`17.9 ${t('unit_millions')}`}
                                icon="👥"
                                color="indigo"
                                isRtl={isRtl}
                            />
                            <StatCard
                                title={t('data_coverage')}
                                value="89%"
                                icon="📊"
                                color="green"
                                isRtl={isRtl}
                            />
                            <StatCard
                                title={t('last_updated')}
                                value="2026"
                                icon="📅"
                                color="purple"
                                isRtl={isRtl}
                            />
                        </div>
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

                    {!selectedStats && !isLoading && (
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-start">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                                {t('how_to_use')}
                            </h3>
                            <ul className="text-xs text-slate-500 leading-relaxed font-medium space-y-3">
                                <li className={`flex items-start gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                    <span className="text-primary">•</span>
                                    <span>{t('instruction_1')}</span>
                                </li>
                                <li className={`flex items-start gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                    <span className="text-primary">•</span>
                                    <span>{t('instruction_2')}</span>
                                </li>
                                <li className={`flex items-start gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                    <span className="text-primary">•</span>
                                    <span>{t('instruction_3')}</span>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Stat Card Component
function StatCard({ title, value, icon, color, isRtl }: {
    title: string;
    value: string;
    icon: string;
    color: 'blue' | 'indigo' | 'green' | 'purple';
    isRtl: boolean;
}) {
    // Adapted colors for light/dark mode compatibility
    const colorClasses = {
        blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
        green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
        purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    };

    return (
        <div className={`${colorClasses[color]} rounded-xl border p-4 text-start`}>
            <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="text-start">
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                </div>
                <span className="text-3xl grayscale opacity-80">{icon}</span>
            </div>
        </div>
    );
}
