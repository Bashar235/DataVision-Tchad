import React, { useState, useEffect } from 'react';
import { Calendar, Clock, FileText, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ScheduleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (formData: { scheduledTime: string; details: string }) => void;
    initialData?: { scheduled_time: string; details: string };
    mode?: 'create' | 'edit';
}

const ScheduleDialog = ({ isOpen, onClose, onConfirm, initialData, mode = 'create' }: ScheduleDialogProps) => {
    const { t } = useLanguage();
    const [scheduledTime, setScheduledTime] = useState('');
    const [details, setDetails] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Format for datetime-local: YYYY-MM-DDTHH:mm
                const date = new Date(initialData.scheduled_time);
                // Adjust to local time before slicing
                const tzOffset = date.getTimezoneOffset() * 60000;
                const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
                setScheduledTime(localISOTime);
                setDetails(initialData.details);
            } else {
                setScheduledTime('');
                setDetails('');
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm({ scheduledTime, details });
        onClose();
    };

    const title = mode === 'edit' ? t('edit_export') || 'Edit Export' : t('schedule_export') || 'Schedule Export';
    const subtitle = mode === 'edit'
        ? t('edit_export_desc') || 'Modify the details of your automated report.'
        : t('schedule_export_desc') || 'Choose the date and details for your automated report.';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.06)] w-full max-w-md p-8 relative animate-in fade-in zoom-in duration-300 rounded-2xl">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-6 top-6 rounded-full p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* Header */}
                <div className="mb-8 text-start">
                    <h2 className="text-xl font-bold flex items-center gap-3 text-slate-950">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        {title}
                    </h2>
                    <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                        {subtitle}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Date Picker */}
                    <div className="space-y-2 text-start">
                        <label className="text-sm font-semibold flex items-center gap-2 text-slate-950">
                            <Clock className="h-4 w-4 text-slate-400" /> {t('date_time') || 'Date & Time'}
                        </label>
                        <input
                            type="datetime-local"
                            required
                            className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                        />
                    </div>

                    {/* Details Field */}
                    <div className="space-y-2 text-start">
                        <label className="text-sm font-semibold flex items-center gap-2 text-slate-950">
                            <FileText className="h-4 w-4 text-slate-400" /> {t('details') || 'Details'}
                        </label>
                        <textarea
                            placeholder={t('details_placeholder') || "Ex: Monthly GDP report Logone Oriental..."}
                            required
                            className="flex min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 resize-none"
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 mt-8">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-all"
                        >
                            {t('cancel') || 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all"
                        >
                            {t('confirm') || 'Confirm'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ScheduleDialog;
