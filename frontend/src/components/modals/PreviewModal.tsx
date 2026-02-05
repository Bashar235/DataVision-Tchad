import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";

interface PreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    filename: string;
    headers: string[];
    data: any[];
}

const PreviewModal = ({ isOpen, onClose, filename, headers, data }: PreviewModalProps) => {
    const { t, isRtl } = useLanguage();

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className={`max-w-4xl ${isRtl ? "rtl" : "ltr"}`}>
                <DialogHeader className="text-start">
                    <DialogTitle>{t('preview_dataset')}: {filename}</DialogTitle>
                </DialogHeader>
                <div className="mt-4 overflow-x-auto max-h-[60vh]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {headers.map((head) => (
                                    <TableHead key={head} className="text-start whitespace-nowrap">{head}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((row, i) => (
                                <TableRow key={i}>
                                    {headers.map((head) => (
                                        <TableCell key={head} className="text-start truncate max-w-[200px]" title={String(row[head])}>
                                            {String(row[head])}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PreviewModal;
