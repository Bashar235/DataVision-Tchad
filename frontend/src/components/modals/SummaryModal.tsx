import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle, AlertCircle } from "lucide-react";
import IntegrityGauge from "../charts/IntegrityGauge";

interface SummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    summary: {
        rows_cleaned: number;
        nulls_fixed: number;
        duplicates_removed: number;
        health_score?: number;
    } | null;
}

const SummaryModal = ({ isOpen, onClose, summary }: SummaryModalProps) => {
    const { t, isRtl } = useLanguage();

    if (!summary) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className={isRtl ? "rtl" : "ltr"}>
                <DialogHeader className="text-start">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                        <DialogTitle>{t('cleaning_results_title')}</DialogTitle>
                    </div>
                </DialogHeader>
                <div className="py-4 space-y-4 text-start">
                    {summary.health_score !== undefined && (
                        <div className="flex flex-col items-center gap-2 mb-4">
                            <IntegrityGauge score={summary.health_score} />
                            <p className={`text-sm font-bold mt-2 ${summary.health_score >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {summary.health_score >= 95
                                    ? t('cleaning_success_unlocked', { score: summary.health_score.toString() })
                                    : t('cleaning_failure_review', { score: summary.health_score.toString() })
                                }
                            </p>
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                        <div className="flex justify-between p-3 bg-accent rounded-lg">
                            <span className="font-medium">{t('cleaned_rows_label')}</span>
                            <span className="font-bold">{summary.rows_cleaned}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-accent rounded-lg">
                            <span className="font-medium">{t('nulls_fixed_label')}</span>
                            <span className="font-bold">{summary.nulls_fixed}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-accent rounded-lg">
                            <span className="font-medium">{t('duplicates_removed_label')}</span>
                            <span className="font-bold">{summary.duplicates_removed}</span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={onClose} className="w-full">{t('common_success')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SummaryModal;
