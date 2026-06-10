import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/dashboard/LanguageSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";

export const AnalystHeader = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { t, isRtl } = useLanguage();
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        if (logout) {
            await logout();
        }
        toast({
            title: t('logout_success'),
            description: t('logout_description'),
        });
        navigate("/");
    };

    return (
        <header className="shrink-0 bg-[#1e1f20] border-b border-[#e3e3e3]/10 shadow-sm z-40">
            <div className="flex items-center justify-between px-4 h-16">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                            <img src="/logo.ico" alt="Logo" className="h-6 w-6 object-contain" />
                        </div>
                        <div className="text-start">
                            <h1 className="font-bold text-lg text-white">{t('nav_brand')}</h1>
                            <p className="text-xs text-white/60">{t('inseed_platform')}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <LanguageSwitcher />
                    <div className="hidden md:block border-inline-start border-white/10 ps-4 me-2">
                        <p className="text-sm font-medium text-white">{user?.full_name || t('dashboard_analyst')}</p>
                        <p className="text-xs text-white/60 text-end-logical">{user?.email}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="text-white hover:bg-white/10">
                        <LogOut className={`h-5 w-5 ${isRtl ? 'rotate-180' : ''}`} />
                    </Button>
                </div>
            </div>
        </header>
    );
};

export default AnalystHeader;
