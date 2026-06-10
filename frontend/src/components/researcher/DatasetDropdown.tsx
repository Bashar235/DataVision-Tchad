import React, { useState, useEffect, useCallback } from 'react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DatasetMeta {
  id: string;
  name: string;
  category: string;
  row_count: number;
  columns: string[];
  baseline_year: number | null;
  date: string;
}

export interface BaselineData {
  lastYear: number;
  ISF: number | null;
  e0: number | null;
  TMI: number | null;
  Cc: number | null;
  Cm: number | null;
  provinces: string[];
}

interface DatasetDropdownProps {
  onDatasetSelect: (dataset: DatasetMeta | null) => void;
  onBaselineLoaded?: (baseline: BaselineData) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DatasetDropdown: React.FC<DatasetDropdownProps> = ({
  onDatasetSelect,
  onBaselineLoaded,
}) => {
  const { t } = useLanguage();
  const [datasets, setDatasets]       = useState<DatasetMeta[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingBaseline, setLoadingBaseline] = useState(false);
  const [selectedId, setSelectedId]   = useState<string>('');
  const [baselineInfo, setBaselineInfo] = useState<BaselineData | null>(null);

  // ── Fetch available datasets on mount ──────────────────────────────────────
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const token = sessionStorage.getItem('authToken');
        const response = await axios.get(
          `${API_URL}/api/v1/ml/researcher-datasets`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setDatasets(response.data);
      } catch (error) {
        console.error('Failed to fetch researcher datasets:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDatasets();
  }, []);

  // ── Fetch real baseline values when a dataset is selected ─────────────────
  const fetchBaseline = useCallback(async (datasetId: string) => {
    setLoadingBaseline(true);
    setBaselineInfo(null);
    try {
      const token = sessionStorage.getItem('authToken');
      const res = await axios.get(
        `${API_URL}/api/v1/ml/dataset-baseline/${datasetId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const d = res.data;
      const baseline: BaselineData = {
        lastYear:  d.last_year,
        ISF:       d.ISF  ?? null,
        e0:        d.e0   ?? null,
        TMI:       d.TMI  ?? null,
        Cc:        d.Cc   ?? null,
        Cm:        d.Cm   ?? null,
        provinces: d.provinces ?? [],
      };
      setBaselineInfo(baseline);
      onBaselineLoaded?.(baseline);
    } catch (err) {
      console.error('Failed to fetch dataset baseline:', err);
    } finally {
      setLoadingBaseline(false);
    }
  }, [onBaselineLoaded]);

  // ── Selection handler ──────────────────────────────────────────────────────
  const handleValueChange = (val: string) => {
    setSelectedId(val);
    if (!val) {
      setBaselineInfo(null);
      onDatasetSelect(null);
      return;
    }
    const ds = datasets.find(d => d.id === val) || null;
    onDatasetSelect(ds);
    if (ds) fetchBaseline(ds.id);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-foreground uppercase tracking-tight block">
          {t('researcher_dataset_label')}
        </label>
        <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 border border-border/40 rounded-md bg-muted/20">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {t('researcher_dataset_loading')}
        </div>
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-foreground uppercase tracking-tight block">
          {t('researcher_dataset_label')}
        </label>
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs rounded-md border border-amber-200 dark:border-amber-800 flex items-start gap-2">
          <Database className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{t('researcher_dataset_none')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <label className="text-[11px] font-semibold text-foreground uppercase tracking-tight block">
        {t('researcher_dataset_label')}
      </label>

      <Select value={selectedId} onValueChange={handleValueChange}>
        <SelectTrigger className="w-full h-9 text-xs bg-background border-border/60">
          <SelectValue placeholder={t('researcher_dataset_placeholder')} />
        </SelectTrigger>
        <SelectContent>
          {datasets.map(ds => (
            <SelectItem key={ds.id} value={ds.id} className="text-xs py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate max-w-[140px]">{ds.name}</span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 h-3.5 bg-primary/5 border-primary/20 shrink-0"
                >
                  {ds.category}
                </Badge>
                {ds.baseline_year && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {ds.baseline_year}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground shrink-0">
                  ({ds.row_count} {t('researcher_dataset_rows')})
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Baseline summary card shown after selection */}
      {loadingBaseline && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t('researcher_reading_baseline')}
        </div>
      )}

      {baselineInfo && !loadingBaseline && (
        <div className="rounded-md border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
            <CheckCircle2 className="w-3 h-3" />
            {t('researcher_baseline_year')}: {baselineInfo.lastYear}
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
            {baselineInfo.ISF !== null && (
              <span className="text-[10px] text-muted-foreground">
                ISF: <span className="font-mono text-foreground">{baselineInfo.ISF.toFixed(2)}</span>
              </span>
            )}
            {baselineInfo.e0 !== null && (
              <span className="text-[10px] text-muted-foreground">
                e0: <span className="font-mono text-foreground">{baselineInfo.e0.toFixed(1)}</span>
              </span>
            )}
            {baselineInfo.TMI !== null && (
              <span className="text-[10px] text-muted-foreground">
                TMI: <span className="font-mono text-foreground">{baselineInfo.TMI.toFixed(1)}</span>
              </span>
            )}
          </div>
          {baselineInfo.provinces.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              {t('researcher_provinces_detected', { count: baselineInfo.provinces.length })}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
