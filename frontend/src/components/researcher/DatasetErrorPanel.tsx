import React from 'react';
import { AlertCircle, Info, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditError {
  type: 'missing_cols' | 'too_few_years' | 'server_error';
  cols?: string[];       // column keys
  count?: number;
}

export interface AuditResult {
  isCompatible: boolean;
  errors: AuditError[];
}

interface DatasetErrorPanelProps {
  auditResult: AuditResult | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DatasetErrorPanel: React.FC<DatasetErrorPanelProps> = ({ auditResult }) => {
  const { t } = useLanguage();

  const getColLabel = (col: string) => {
    const key = `col_label_${col.toLowerCase()}`;
    const localized = t(key);
    // If translation returns the key itself (missing), fallback to col name
    return localized !== key ? `${col} (${localized})` : col;
  };

  if (!auditResult || auditResult.isCompatible) return null;

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">

      {/* ── Main incompatibility alert ─────────────────────────────────────── */}
      <Alert
        variant="destructive"
        className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 py-3"
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <AlertTitle className="text-red-800 dark:text-red-200 font-semibold text-xs">
          {t('researcher_error_panel_title')}
        </AlertTitle>
        <AlertDescription className="text-red-700 dark:text-red-300 mt-2 space-y-1.5">
          <p className="text-[11px]">{t('researcher_error_panel_desc')}</p>

          {/* Per-column callouts */}
          <ul className="space-y-1 mt-1.5">
            {auditResult.errors.map((err, idx) => {
              if (err.type === 'missing_cols') {
                return (err.cols ?? []).map((col, ci) => (
                  <li
                    key={`${idx}-${ci}`}
                    className="flex items-start gap-1.5 text-[11px]"
                  >
                    <XCircle className="w-3 h-3 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold">{t('dataset_error_incompatible')}</span>{' '}
                      {t('dataset_error_model_predict_missing_col', { col, label: getColLabel(col) })}
                    </span>
                  </li>
                ));
              }
              if (err.type === 'too_few_years') {
                return (
                  <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                    <XCircle className="w-3 h-3 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold">{t('dataset_error_insufficient_history')}</span>{' '}
                      {t('dataset_error_lstm_requirement', { count: err.count, plural: err.count !== 1 ? 's' : '' })}
                    </span>
                  </li>
                );
              }
              if (err.type === 'server_error') {
                return (
                  <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                    <XCircle className="w-3 h-3 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold">{t('dataset_error_server_error', {}, 'Server Error')}</span>{' '}
                      {t('dataset_error_health_check_failed', {}, 'Failed to retrieve dataset health. Please verify your connection to the predictive services.')}
                    </span>
                  </li>
                );
              }
              return null;
            })}
          </ul>
        </AlertDescription>
      </Alert>

      {/* ── Guidance info box ──────────────────────────────────────────────── */}
      <Alert className="bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50 py-3">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <AlertTitle className="font-semibold text-blue-900 dark:text-blue-200 text-xs">
          {t('researcher_error_guidance')}
        </AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-[11px] mt-1">
          {t('researcher_error_guidance_text')}
          {' '}{t('researcher_required_schema_is')}:{' '}
          <code className="font-mono text-[10px] bg-blue-100 dark:bg-blue-900/40 px-1 rounded">
            year, province, population, ISF, e0, TMI, Cc, Cm
          </code>
        </AlertDescription>
      </Alert>
    </div>
  );
};
