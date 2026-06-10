import React from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';

interface GenderStat {
    name: string;
    value: number;
    percentage: number;
}

interface AgeStat {
    age_group: string;
    male: number;
    female: number;
    population: number;
    percentage: number;
}

interface RegionStats {
    region_id: string;
    province_name: string;
    province_name_fr: string;
    capital: string;
    gender_stats: GenderStat[];
    age_stats: AgeStat[];
    data_source: string;
    quality_score?: number;
    passed_quality_gate?: boolean;
    population_projection?: number;
    selected_year?: number;
    errors?: { type: string; message: string }[];
}

interface ProvinceDetailsProps {
    stats: RegionStats | null;
    loading: boolean;
    mode: 'insight' | 'audit';
}

const REGION_MAP: Record<string, string> = {
    "Tchad": "region_tchad",
    "N'Djamena": "region_TD_ND",
    "N'Djaména": "region_TD_ND",
    "Batha": "region_TD_BA",
    "Borkou": "region_TD_BO",
    "Chari-Baguirmi": "region_TD_CB",
    "Chari Baguirmi": "region_TD_CB",
    "Guéra": "region_TD_GU",
    "Hadjer-Lamis": "region_TD_HL",
    "Hadjer Lamis": "region_TD_HL",
    "Kanem": "region_TD_KA",
    "Lac": "region_TD_LC",
    "Logone Occidental": "region_TD_LO",
    "Logone Oriental": "region_TD_LR",
    "Mandoul": "region_TD_MA",
    "Mayo-Kebbi Est": "region_TD_ME",
    "Mayo Kebbi Est": "region_TD_ME",
    "Mayo-Kebbi Ouest": "region_TD_MO",
    "Mayo Kebbi Ouest": "region_TD_MO",
    "Moyen-Chari": "region_TD_MC",
    "Moyen Chari": "region_TD_MC",
    "Ouaddaï": "region_TD_OU",
    "Salamat": "region_TD_SA",
    "Tandjilé": "region_TD_TA",
    "Wadi Fira": "region_TD_WF",
    "Barh El Gazal": "region_TD_BG",
    "Barh El Gazel": "region_TD_BG",
    "Bahr el Gazel": "region_TD_BG",
    "Bahr El Gazel": "region_TD_BG",
    "Ennedi": "region_TD_EE",
    "Ennedi Est": "region_TD_EE",
    "Ennedi-Est": "region_TD_EE",
    "Ennedi Ouest": "region_TD_EO",
    "Ennedi-Ouest": "region_TD_EO",
    "Sila": "region_TD_SI",
    "Tibesti": "region_TD_TI",
};

const MALE_COLOR = '#3f7fc7';
const FEMALE_COLOR = '#d75a7d';

const getAgeSortValue = (ageGroup: string) => {
    const match = ageGroup?.match(/^\s*(\d+)/);
    return match ? Number(match[1]) : 999;
};

const isFiveYearCohort = (ageGroup: string) => {
    const trimmed = ageGroup?.trim() ?? '';
    const range = trimmed.match(/^(\d+)-(\d+)$/);
    if (trimmed.endsWith('+') && /^\d+\+$/.test(trimmed)) return true;
    if (!range) return false;
    return Number(range[2]) - Number(range[1]) === 4;
};

const ProvinceDetails = ({ stats, loading, mode }: ProvinceDetailsProps) => {
    const { t, isRtl } = useLanguage();

    if (loading) {
        return (
            <div className={`p-6 bg-white rounded-2xl border border-gray-200 shadow-sm animate-pulse ${isRtl ? 'text-end' : 'text-start'}`}>
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-8"></div>
                <div className="space-y-6">
                    <div className="h-40 bg-gray-50 rounded-xl"></div>
                    <div className="h-40 bg-gray-50 rounded-xl"></div>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 min-h-[400px] flex items-center justify-center">
                <p className="text-slate-500 text-sm p-4">
                    {t('map_instruction')}
                </p>
            </div>
        );
    }

    const COLORS = [MALE_COLOR, FEMALE_COLOR]; // Male/Female colors
    const regionKey = REGION_MAP[stats.province_name] || `region_${stats.region_id.replace('-', '_')}`;
    const pyramidData = (stats.age_stats ?? [])
        .filter((row) => isFiveYearCohort(row.age_group))
        .sort((a, b) => getAgeSortValue(b.age_group) - getAgeSortValue(a.age_group))
        .map((row) => ({
            ...row,
            male: Number(row.male ?? 0),
            female: Number(row.female ?? 0),
        }));
    const maxPopulation = Math.max(
        1,
        ...pyramidData.flatMap((row) => [row.male, row.female])
    );

    return (
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? "rtl" : "ltr"}>
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 shrink-0 text-start">
                <h3 className="text-xl font-bold text-slate-900 capitalize">
                    {t(regionKey as any) || stats.province_name}
                </h3>
                <p className={`text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1`}>
                    {t('capital_city')}: {stats.capital}
                </p>
            </div>

            <div className="p-5 flex-1 space-y-8">
                {mode === 'insight' ? (
                    <>
                        {/* Gender Distribution (Pie Chart) */}
                        <div className="flex flex-col text-start">
                            <h4 className={`text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-4`}>
                                {t('gender_distribution')}
                            </h4>
                            <div className="h-[220px] w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.gender_stats}
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {stats.gender_stats?.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', textAlign: isRtl ? 'right' : 'left' }}
                                            formatter={(value: number) => [`${value.toLocaleString()}`, '']}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className={`flex justify-center gap-6 mt-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                {stats.gender_stats?.map((entry, i) => (
                                    <div key={entry.name} className="flex items-center gap-2">
                                        <div className="w-2 rounded-full h-2" style={{ backgroundColor: COLORS[i % COLORS.length] } as React.CSSProperties} />
                                        <span className="text-[11px] font-bold text-slate-600 uppercase">
                                            {entry.name === 'Male' ? t('gender_male') : entry.name === 'Female' ? t('gender_female') : entry.name} ({entry.percentage}%)
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Population Pyramid (Disaggregated Age Stats) */}
                        <div className="flex flex-col pb-8 text-start">
                            <h4 className={`text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-4`}>
                                {t('population_pyramid')}
                            </h4>
                            <div className="h-[340px] w-full relative">
                                <div className="mb-2 grid grid-cols-[1fr_54px_1fr] items-center text-[10px] font-bold uppercase text-slate-500">
                                    <span className="text-end pe-2">{t('gender_male')}</span>
                                    <span className="text-center">{t('indicator_age_groups')}</span>
                                    <span className="ps-2">{t('gender_female')}</span>
                                </div>
                                <div className="grid h-[300px] grid-cols-[1fr_54px_1fr] items-stretch">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={pyramidData}
                                            layout="vertical"
                                            margin={{ top: 4, right: 0, left: 0, bottom: 22 }}
                                            barCategoryGap="24%"
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis
                                                type="number"
                                                domain={[0, maxPopulation]}
                                                reversed
                                                tickFormatter={(v) => Number(v).toLocaleString()}
                                                fontSize={9}
                                                tick={{ fill: '#64748b' }}
                                                axisLine={false}
                                                tickLine={false}
                                                label={{ value: t('population'), position: 'insideBottom', offset: -16, fontSize: 9, fill: '#64748b' }}
                                            />
                                            <YAxis dataKey="age_group" type="category" hide />
                                            <Tooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px', textAlign: isRtl ? 'right' : 'left' }}
                                                formatter={(value: number) => [Number(value).toLocaleString(), t('gender_male')]}
                                                labelFormatter={(label) => `${t('indicator_age_groups')}: ${label}`}
                                            />
                                            <Bar dataKey="male" fill={MALE_COLOR} name={t('gender_male')} radius={[4, 0, 0, 4]} />
                                        </BarChart>
                                    </ResponsiveContainer>

                                    <div className="flex h-[278px] flex-col justify-between border-x border-slate-200 bg-white pt-1.5 text-center">
                                        {pyramidData.map((row) => (
                                            <span key={row.age_group} className="text-[10px] font-semibold leading-none text-slate-600">
                                                {row.age_group}
                                            </span>
                                        ))}
                                    </div>

                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={pyramidData}
                                            layout="vertical"
                                            margin={{ top: 4, right: 0, left: 0, bottom: 22 }}
                                            barCategoryGap="24%"
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis
                                                type="number"
                                                domain={[0, maxPopulation]}
                                                tickFormatter={(v) => Number(v).toLocaleString()}
                                                fontSize={9}
                                                tick={{ fill: '#64748b' }}
                                                axisLine={false}
                                                tickLine={false}
                                                label={{ value: t('population'), position: 'insideBottom', offset: -16, fontSize: 9, fill: '#64748b' }}
                                            />
                                            <YAxis dataKey="age_group" type="category" hide />
                                            <Tooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px', textAlign: isRtl ? 'right' : 'left' }}
                                                formatter={(value: number) => [Number(value).toLocaleString(), t('gender_female')]}
                                                labelFormatter={(label) => `${t('indicator_age_groups')}: ${label}`}
                                            />
                                            <Bar dataKey="female" fill={FEMALE_COLOR} name={t('gender_female')} radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="flex justify-center gap-4 mt-2">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: MALE_COLOR } as React.CSSProperties} />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{t('gender_male')}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: FEMALE_COLOR } as React.CSSProperties} />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{t('gender_female')}</span>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Audit Mode Content */
                    <div className="space-y-6 text-start">
                        <div className={`p-5 rounded-2xl ${stats.passed_quality_gate
                            ? 'bg-emerald-50 border border-emerald-100'
                            : 'bg-rose-50 border border-rose-100'
                            }`}>
                            <div className={`flex items-center justify-between mb-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('quality_score')}</span>
                                <span className={`text-3xl font-black ${stats.passed_quality_gate ? 'text-emerald-600' : 'text-rose-600'
                                    }`}>
                                    {stats.quality_score}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-200/50 h-2 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-1000 ${stats.passed_quality_gate ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                    style={{ width: `${stats.quality_score}%` } as React.CSSProperties}
                                ></div>
                            </div>
                            <p className={`text-[10px] font-bold mt-3 uppercase tracking-widest ${stats.passed_quality_gate ? 'text-emerald-600' : 'text-rose-600'
                                }`}>
                                {stats.passed_quality_gate
                                    ? `✓ ${t('status_meets_standards')}`
                                    : `✗ ${t('status_below_threshold')}`}
                            </p>
                        </div>

                        {stats.population_projection && (
                            <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">{t('population_projection')} ({stats.selected_year})</span>
                                <div className="text-3xl font-black text-indigo-900 mt-1">
                                    {(stats.population_projection / 1000000).toFixed(1)} {t('unit_millions')}
                                </div>
                                <p className="text-[10px] text-indigo-600/70 font-bold mt-1 uppercase italic">
                                    {t('map_inseed_scenario')}
                                </p>
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-100">
                            <h4 className={`text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2`}>
                                {t('quality_summary_title')}
                            </h4>
                            <p className={`text-[11px] text-slate-600 leading-relaxed`}>
                                {t('quality_score_summary')}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className={`p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0`}>
                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50/50 px-3 py-1.5 rounded-full border border-indigo-100 uppercase tracking-tighter w-full text-center">
                    {stats.data_source === 'mock_data' ? t('simulated') : t('ledger_verified')}
                </span>
            </div>
        </div>
    );
};

export default ProvinceDetails;
