import SecurityCenter from "@/components/dashboard/SecurityCenter";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/dashboard/LanguageSwitcher";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const AdminSecurity = () => {
    const { t, isRtl } = useLanguage();
    const navigate = useNavigate();

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="border-b bg-card shrink-0">
                    <div className="px-4 py-4 md:px-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="px-2"
                                    onClick={() => navigate("/admin")}
                                >
                                    {isRtl ? <ChevronRight className="w-5 h-5 mr-1" /> : <ChevronLeft className="w-5 h-5 mr-1" />}
                                    {t('common_back')}
                                </Button>
                                <div className="h-6 w-px bg-border mx-2" />
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <ShieldCheck className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="text-start">
                                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                                            {t('security_center')}
                                        </h1>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                            <span>{t('admin_panel')}</span>
                                            {isRtl ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                            <span className="font-medium">{t('security_title')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <LanguageSwitcher />
                            </div>
                        </div>
                    </div>
                </header>

                <main className="container mx-auto px-4 py-8 space-y-6 flex-1">
                    <div className="text-start">
                        <h2 className="text-3xl font-bold tracking-tight">{t('security_center')}</h2>
                        <p className="text-muted-foreground">{t('security_audit_log_desc')}</p>
                    </div>

                    <SecurityCenter />
                </main>
            </div>
        </div>
    );
};

export default AdminSecurity;
