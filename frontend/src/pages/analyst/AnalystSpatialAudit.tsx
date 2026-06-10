/**
 * Analyst Spatial Audit Dashboard
 * 
 * Route: /analyst/spatial-audit
 * Purpose: Data Quality Visualization - Shows provinces in Red/Green based on 95% Quality Gate
 */
import { useState, useEffect } from 'react';
import ChadMap from '@/components/maps/ChadMap';
import MapLegend from '@/components/maps/MapLegend';
import ProvinceDetails from '@/components/maps/ProvinceDetails';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import AnalystSidebar from "@/components/dashboard/AnalystSidebar";
import AnalystHeader from "@/components/dashboard/AnalystHeader";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL } from '@/services/api';

interface QualitySummary {
    total: number;
    passed: number;
    failed: number;
}

export default function AnalystSpatialAudit() {
    const { t, isRtl } = useLanguage();
    const { user, loading: authLoading } = useAuth();
    const [selectedStats, setSelectedStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [summary, setSummary] = useState<QualitySummary>({ total: 23, passed: 20, failed: 3 });
    const [selectedYear, setSelectedYear] = useState<number>(2010);

    const [isCollapsed, setIsCollapsed] = useState(true);

    // Fetch quality summary on mount
    useEffect(() => {
        if (authLoading) return;

        const fetchSummary = async () => {
            try {
                const token = sessionStorage.getItem('authToken');
                if (!token) return;

                const response = await fetch(`${API_URL}/api/v1/spatial/quality/all`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setSummary(data.summary);
                }
            } catch (err) {
                console.error('Error fetching quality summary:', err);
            }
        };

        fetchSummary();
    }, [authLoading]);

    const passRate = Math.round((summary.passed / summary.total) * 100);

    return (
        <div className={`flex h-screen w-full bg-background overflow-hidden ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
            <AnalystSidebar isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} />

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                <AnalystHeader />

                <main className="flex-1 flex flex-col h-full overflow-hidden pl-6">
                    <div className="flex-1 flex overflow-hidden">
                        {/* Map Area - Column 2: Now Full Bleed */}
                        <div className="flex-1 relative bg-slate-50">
                            <div className="absolute top-4 right-4 z-[1000] flex gap-2">
                                <div className="bg-white/90 backdrop-blur shadow-md rounded-xl p-1 border border-slate-200 flex items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3">{t('select_years') || 'Year'}</span>
                                    <select 
                                        value={selectedYear} 
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="bg-transparent text-sm font-bold text-slate-700 outline-none pr-3 cursor-pointer"
                                    >
                                        {Array.from({ length: 42 }, (_, i) => 2009 + i).map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <ChadMap
                                mode="audit"
                                year={selectedYear}
                                collapsed={isCollapsed}
                                onStatsUpdate={setSelectedStats}
                                onLoadingChange={setIsLoading}
                            />
                        </div>

                        {/* Data Rail - Column 3: Fixed Right Sidebar */}
                        <div className="w-[380px] shrink-0 h-full overflow-y-auto bg-white border-l border-slate-200 z-10 flex flex-col">
                            <div className="p-6 flex flex-col gap-6 flex-1">
                                {/* Header Card */}
                                <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100/80">
                                    <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-2">
                                        {t('spatial_audit') || 'Spatial Data Audit'}
                                    </h1>
                                    <p className="text-slate-500 text-sm font-medium">
                                        {t('spatial_audit_description') || 'Review data quality across Chad\'s provinces.'}
                                    </p>
                                </div>

                                {/* Quality Summary Card (Sub-grid) */}
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">{t('regions') || 'Regions'}</p>
                                            <p className="text-xl font-bold text-slate-900">{summary.total}</p>
                                        </div>
                                        <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">{t('pass_rate') || 'Pass Rate'}</p>
                                            <p className="text-xl font-bold text-blue-600">{passRate}%</p>
                                        </div>
                                        <div className="p-3 bg-green-50 rounded-xl border border-green-100 shadow-sm">
                                            <p className="text-[10px] uppercase font-black text-green-600/60 tracking-tighter">{t('passed') || 'Passed'}</p>
                                            <p className="text-xl font-bold text-green-600">{summary.passed}</p>
                                        </div>
                                        <div className="p-3 bg-red-50 rounded-xl border border-red-100 shadow-sm">
                                            <p className="text-[10px] uppercase font-black text-red-600/60 tracking-tighter">{t('failed') || 'Failed'}</p>
                                            <p className="text-xl font-bold text-red-600">{summary.failed}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Alert for Failed Regions */}
                                {summary.failed > 0 && (
                                    <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3">
                                        <span className="text-xl">⚠️</span>
                                        <div>
                                            <h3 className="text-destructive text-sm font-bold">
                                                {t('attention_required') || 'Attention Required'}
                                            </h3>
                                            <p className="text-xs text-destructive/80 mt-1 leading-relaxed">
                                                {summary.failed} {t('regions_below_95') || 'region(s) below 95%. Click on red provinces.'}
                                            </p>
                                        </div>
                                    </div>
                                )}

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

                                {/* Remediation info (Static) */}
                                {!selectedStats && !isLoading && (
                                    <div className="space-y-6 mt-auto">
                                        <Card className="border-slate-100 shadow-sm rounded-2xl">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                                    {t('quality_gate_criteria') || '95% Quality Gate Criteria'}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ul className="text-xs text-slate-500 leading-relaxed font-medium space-y-2">
                                                    <li className="flex items-start gap-2">
                                                        <span className="text-green-500 font-bold">✓</span>
                                                        {t('criteria_1') || 'Less than 5% missing values'}
                                                    </li>
                                                    <li className="flex items-start gap-2">
                                                        <span className="text-green-500 font-bold">✓</span>
                                                        {t('criteria_2') || 'Minimal duplicate records'}
                                                    </li>
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div >
        </div >
    );
}
