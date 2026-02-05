
import React, { useState, useEffect } from 'react';
import { X, Mail, FileText, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createSupportTicket } from '@/services/api';

interface ContactSupportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    isUrgent?: boolean;
    defaultSubject?: string;
}

const ContactSupportDialog = ({ isOpen, onClose, isUrgent = false, defaultSubject = '' }: ContactSupportDialogProps) => {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { user } = useAuth();

    const userEmail = user?.email || "";
    const [subject, setSubject] = useState(defaultSubject);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Reset subject when modal opens with new props
    useEffect(() => {
        if (isOpen) {
            setSubject(defaultSubject);
            setMessage('');
            setShowSuccessModal(false);
        }
    }, [isOpen, defaultSubject]);

    const handleClose = () => {
        setSubject('');
        setMessage('');
        setShowSuccessModal(false);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);

        try {
            await createSupportTicket({
                subject,
                message,
                is_urgent: isUrgent
            });

            if (isUrgent) {
                setShowSuccessModal(true);
            } else {
                toast({
                    title: t('support_contact_success_toast'),
                    description: `${t('support_contact_subject')}: ${subject}`,
                    className: 'bg-emerald-500 text-white border-none shadow-lg',
                });
                handleClose();
            }

        } catch (error) {
            console.error('Support request failed:', error);
            toast({
                title: t('common_error'),
                description: t('error_send_support'),
                variant: 'destructive',
            });
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    // Render Critical Success Modal
    if (showSuccessModal) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-md p-8 relative rounded-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
                    <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-slate-950">
                            {t('support_urgent_report_received')}
                        </h2>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wide">
                            <AlertTriangle className="w-3 h-3" />
                            {t('support_priority_urgent')}
                        </div>
                        <p className="text-slate-600 leading-relaxed pt-2">
                            {t('support_urgent_report_description')}
                        </p>
                    </div>

                    <Button
                        onClick={handleClose}
                        className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                    >
                        {t('support_back_to_dashboard')}
                    </Button>
                </div>
            </div>
        );
    }

    // Render Standard Form
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.06)] w-full max-w-lg p-8 relative animate-in fadeIn zoom-in duration-300 rounded-2xl">

                {/* Priority Badge */}
                {isUrgent && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-red-600 to-red-500 animate-pulse rounded-t-2xl" />
                )}

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute right-6 top-6 rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* Header */}
                <div className="mb-8 text-start">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-950">
                            <div className={`${isUrgent ? 'bg-red-100' : 'bg-primary/10'} p-2 rounded-lg transition-colors`}>
                                {isUrgent ? (
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                ) : (
                                    <Mail className="h-6 w-6 text-primary" />
                                )}
                            </div>
                            {isUrgent ? t('support_report_data_issue') : t('support_contact_title')}
                        </h2>
                    </div>

                    {isUrgent && (
                        <div className="flex items-center gap-2 p-3 mb-2 bg-red-50 text-red-700 border border-red-100 rounded-lg animate-pulse">
                            <AlertTriangle size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">{t('support_priority_urgent')}</span>
                        </div>
                    )}

                    <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                        {t('profile_contact_admin')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* From Field (Read-Only) */}
                    <div className="space-y-2 text-start">
                        <Label htmlFor="from" className="text-sm font-semibold text-slate-950 ml-1">
                            {t('support_contact_from')}
                        </Label>
                        <Input
                            id="from"
                            type="email"
                            value={userEmail}
                            readOnly
                            disabled
                            className="h-12 rounded-xl border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed"
                        />
                    </div>

                    {/* Subject Field */}
                    <div className="space-y-2 text-start">
                        <Label htmlFor="subject" className="text-sm font-semibold text-slate-950 ml-1">
                            {t('support_contact_subject')}
                        </Label>
                        <Input
                            id="subject"
                            type="text"
                            required
                            placeholder={t('support_contact_subject_placeholder') || "Brief description..."}
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            readOnly={isUrgent}
                            disabled={isUrgent}
                            className={`h-12 rounded-xl border-slate-200 ${isUrgent ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'focus:border-primary focus:ring-primary/10'}`}
                        />
                    </div>

                    {/* Message Field */}
                    <div className="space-y-2 text-start">
                        <Label htmlFor="message" className="text-sm font-semibold text-slate-950 ml-1 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            {t('support_contact_message')}
                        </Label>
                        <Textarea
                            id="message"
                            required
                            placeholder={isUrgent ? t('support_urgent_message_placeholder') : t('support_contact_message_placeholder')}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="min-h-[150px] rounded-xl border-slate-200 focus:border-primary focus:ring-primary/10 resize-none"
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 mt-8">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={sending}
                            className="h-12 px-6 rounded-xl border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-all"
                        >
                            {t('common_cancel')}
                        </Button>
                        <Button
                            type="submit"
                            disabled={sending}
                            className={`h-12 px-8 rounded-xl font-bold transition-all active:scale-95 shadow-lg ${isUrgent ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20 text-white' : 'bg-primary hover:bg-primary/90 shadow-primary/20 text-white'}`}
                        >
                            {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {sending ? t('support_contact_sending') : t('support_contact_send')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ContactSupportDialog;
