
import { useLanguage } from '@/contexts/LanguageContext';

interface MapLegendProps {
    mode: 'insight' | 'audit';
    className?: string;
}

export default function MapLegend({ mode, className }: MapLegendProps) {
    const { t, isRtl } = useLanguage();

    const QUALITY_COLORS = {
        passed: '#10b981',  // Emerald 500
        failed: '#ef4444',  // Red 500
    };

    const GENDER_COLORS = ['#3b82f6', '#ec4899']; // Blue, Pink

    return (
        <div
            className={`p-5 min-w-[200px] ${className ? className : 'bg-white border border-border rounded-2xl shadow-lg'}`}
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            <h4 className={`text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 ${isRtl ? 'text-end' : ''}`}>
                {mode === 'audit' ? t('quality_audit') : t('spatial_distribution')}
            </h4>

            {mode === 'audit' && (
                <div className="space-y-3">
                    <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <div className="w-5 h-5 rounded-lg shadow-sm border border-emerald-200 bg-emerald-50 flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                        </div>
                        <div className={`flex flex-col ${isRtl ? 'items-end' : ''}`}>
                            <span className="text-[11px] font-bold text-foreground tracking-tight">{t('passed')}</span>
                            <span className="text-[9px] text-muted-foreground font-medium tracking-tighter">{t('score_meets')}</span>
                        </div>
                    </div>
                    <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <div className="w-5 h-5 rounded-lg shadow-sm border border-red-200 bg-red-50 flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                        </div>
                        <div className={`flex flex-col ${isRtl ? 'items-end' : ''}`}>
                            <span className="text-[11px] font-bold text-foreground tracking-tight">{t('failed')}</span>
                            <span className="text-[9px] text-muted-foreground font-medium tracking-tighter">{t('score_fails')}</span>
                        </div>
                    </div>
                </div>
            )}

            {mode === 'insight' && (
                <div className="space-y-4">
                    <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <div className="w-5 h-5 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                        </div>
                        <span className={`text-[11px] font-bold text-foreground tracking-tight leading-none ${isRtl ? 'text-end' : ''}`}>{t('click_province')}</span>
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between">
                        <div className={`flex items-center gap-1.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                            <span className="text-[9px] font-black text-muted-foreground tracking-widest">{t('gender_male')}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${isRtl ? 'flex-row-reverse mr-3' : 'ml-3'}`}>
                            <div className="w-2.5 h-2.5 rounded-full bg-pink-500"></div>
                            <span className="text-[9px] font-black text-muted-foreground tracking-widest">{t('gender_female')}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
