import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle, ArrowRight, Activity, Database, Info } from "lucide-react";
import { getDatasetComparison } from "@/services/api";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetId: string | null;
}

const ComparisonModal = ({ isOpen, onClose, datasetId }: ComparisonModalProps) => {
  const { t, isRtl } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && datasetId) {
      fetchComparison();
    } else {
      // Clear data when closed to avoid seeing old data on next open
      setData(null);
    }
  }, [isOpen, datasetId]);

  const fetchComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDatasetComparison(datasetId!);
      // Ensure we are setting the actual data object
      setData(result.data || result);
    } catch (err: any) {
      console.error("Comparison Error:", err);
      setError(err.response?.data?.detail || "Failed to load comparison data.");
    } finally {
      setLoading(false);
    }
  };

  const isAnomalous = (rowIdx: number, field: string) => {
    if (!data?.report?.anomalies) return false;
    return data.report.anomalies.some(
      (a: any) => a.row === rowIdx && a.field?.toLowerCase() === field.toLowerCase()
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* INCREASED SIZE: Changed max-w-4xl to max-w-6xl.
          ADDED: w-[95vw] for responsive scaling.
          ADDED: h-[85vh] to maximize vertical space for the tables.
      */}
      <DialogContent
        dir={isRtl ? "rtl" : "ltr"}
        className="fixed left-[50%] top-[50%] z-[100] translate-x-[-50%] translate-y-[-50%] 
                   w-[95vw] max-w-6xl h-[85vh] 
                   shadow-2xl rounded-2xl flex flex-col p-0 overflow-hidden bg-white border-none"
      >

        <DialogHeader className="p-8 bg-white border-b shrink-0">
          <div className="flex justify-between items-center">
            <div className="text-start">
              <DialogTitle className={`text-2xl font-bold flex items-center gap-3 text-slate-800 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                <Activity className="w-6 h-6 text-emerald-600" />
                {t('modal_ai_audit_title')} : {data?.filename || t('chart_pending')}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{t('modal_comparison_desc')}</p>
            </div>

            {data?.report && (
              <div className="flex gap-6">
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-2 text-center shadow-sm">
                  <p className="text-[10px] text-amber-700 uppercase font-black tracking-widest">{t('modal_anomalies_label')}</p>
                  <p className="text-xl font-bold text-amber-600">{data.report.total_anomalies}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-2 text-center shadow-sm">
                  <p className="text-[10px] text-emerald-700 uppercase font-black tracking-widest">{t('modal_quality_score_label')}</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {Math.round(data.report.overall_score * 100)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-8 bg-slate-50/30">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">{t('modal_syncing')}</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <div className="p-4 bg-red-50 rounded-full">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
              <p className="text-base font-medium text-slate-600 max-w-md">{error}</p>
              <Button variant="outline" onClick={fetchComparison}>{t('modal_retry_connection')}</Button>
            </div>
          ) : data?.raw_preview ? (
            <div className="h-full grid grid-cols-1 md:grid-cols-2 gap-8 overflow-hidden">

              {/* RAW PANEL (Left) */}
              <div className="flex flex-col border rounded-2xl bg-white shadow-md overflow-hidden border-slate-200">
                <div className="bg-slate-100 px-4 py-3 border-b flex justify-between items-center">
                  <span className={`text-xs font-black text-slate-500 uppercase flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <Database className="w-4 h-4" /> {t('modal_raw_data')}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{t('modal_source_original')}</Badge>
                </div>
                <div className="flex-1 overflow-auto">
                  <Table className="relative">
                    <TableHeader className="bg-slate-50 sticky top-0 z-20">
                      <TableRow>
                        {Object.keys(data.raw_preview[0] || {}).map(k => (
                          <TableHead key={k} className="text-[10px] uppercase font-bold px-4 py-4">{k}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.raw_preview.map((row: any, i: number) => (
                        <TableRow key={i} className="hover:bg-slate-50/50">
                          {Object.entries(row).map(([key, val]: any, j) => (
                            <TableCell key={j} className={`text-[12px] px-4 py-3 font-mono border-r last:border-0 ${isAnomalous(i, key) ? 'bg-amber-50/60 text-amber-800' : 'text-slate-600'}`}>
                              {val}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* CLEANED PANEL (Right) */}
              <div className="flex flex-col border rounded-2xl bg-white shadow-md overflow-hidden border-emerald-200 ring-2 ring-emerald-50/50">
                <div className="bg-emerald-50/50 px-4 py-3 border-b flex justify-between items-center">
                  <span className={`text-xs font-black text-emerald-700 uppercase flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <CheckCircle className="w-4 h-4" /> {t('modal_ai_proposal')}
                  </span>
                  <Badge className="bg-emerald-600 text-[10px]">{t('modal_auto_correction')}</Badge>
                </div>
                <div className="flex-1 overflow-auto">
                  <Table className="relative">
                    <TableHeader className="bg-emerald-50/30 sticky top-0 z-20">
                      <TableRow>
                        {Object.keys(data.clean_preview[0] || {}).map(k => (
                          <TableHead key={k} className="text-[10px] uppercase font-bold text-emerald-900/60 px-4 py-4">{k}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.clean_preview.map((row: any, i: number) => (
                        <TableRow key={i} className="hover:bg-emerald-50/20">
                          {Object.entries(row).map(([key, val]: any, j) => {
                            const anomaly = isAnomalous(i, key);
                            return (
                              <TableCell
                                key={j}
                                className={`text-[12px] px-4 py-3 font-mono border-r last:border-0 ${anomaly ? 'bg-red-50 text-red-600 font-bold' : 'text-emerald-700'}`}
                              >
                                {val} {anomaly && <span className="ml-1">⚠️</span>}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 italic">
              {t('modal_no_data_available')}
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-white border-t shrink-0 flex items-center justify-between">
          <div className={`flex items-center gap-3 text-slate-400 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Info className="w-5 h-5" />
            <p className="text-[11px] uppercase font-black tracking-widest">
              {t('modal_validation_required')}
            </p>
          </div>
          <div className={`flex gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Button variant="ghost" onClick={onClose} className="text-xs uppercase font-bold tracking-widest px-6">{t('profile_cancel')}</Button>
            <Button
              className={`bg-emerald-600 hover:bg-emerald-700 text-xs uppercase font-bold tracking-widest flex items-center gap-3 px-8 py-6 shadow-xl shadow-emerald-100 ${isRtl ? 'flex-row-reverse' : ''}`}
              onClick={() => {
                onClose();
                navigate(`/analyst/cleaning-console/${datasetId}`);
              }}
            >
              {t('modal_access_console')}
              <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComparisonModal;