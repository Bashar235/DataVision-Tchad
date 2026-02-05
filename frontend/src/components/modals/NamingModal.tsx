import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { sanitizeFilename } from "@/utils/fileUtils";

interface NamingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (filename: string) => void;
    defaultFilename?: string;
}

const NamingModal = ({ isOpen, onClose, onConfirm, defaultFilename = "" }: NamingModalProps) => {
    const { t, isRtl } = useLanguage();
    const [filename, setFilename] = useState(defaultFilename);

    useEffect(() => {
        if (isOpen) {
            setFilename(defaultFilename);
        }
    }, [isOpen, defaultFilename]);

    const handleConfirm = () => {
        const sanitized = sanitizeFilename(filename);
        onConfirm(sanitized);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className={isRtl ? "rtl" : "ltr"}>
                <DialogHeader className="text-start">
                    <DialogTitle>{t('enter_file_name')}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-2 text-start">
                    <Label htmlFor="filename">{t('table_head_activity')}</Label>
                    <Input
                        id="filename"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        placeholder={t('file_name_placeholder')}
                        autoFocus
                    />
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>{t('common_cancel')}</Button>
                    <Button onClick={handleConfirm}>{t('common_confirm')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default NamingModal;
