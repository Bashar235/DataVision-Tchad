import SecurityCenter from "@/components/dashboard/SecurityCenter";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/dashboard/LanguageSwitcher";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const AdminSecurity = () => {
    const { t, isRtl } = useLanguage();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/admin")}>
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <ShieldCheck className="w-6 h-6 text-primary" />
                        </div>
                        <div className="text-start">
                            <h1 className="text-xl font-bold">{t('nav_brand')} Tchad</h1>
                            <p className="text-sm text-muted-foreground">{t('security')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                            {t('nav_home')}
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 space-y-6">
                <div className="text-start">
                    <h2 className="text-3xl font-bold tracking-tight">{t('security_center')}</h2>
                    <p className="text-muted-foreground">{t('security_policy')}</p>
                </div>

                <SecurityCenter />
            </main>
        </div>
    );
};

export default AdminSecurity;
