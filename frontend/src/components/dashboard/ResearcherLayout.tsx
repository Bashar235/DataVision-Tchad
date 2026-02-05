import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  BarChart3,
  TrendingUp,
  FileText,
  Download,
  User,
  LogOut,
  LayoutDashboard,
  Database
} from "lucide-react";
import ResearcherSidebar from "./ResearcherSidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/dashboard/LanguageSwitcher";
import { useAuth } from "@/contexts/AuthContext";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, isRtl } = useLanguage();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast({
      title: t('logout_success'),
      description: t('logout_description'),
    });
    navigate("/");
  };

  const mainPadding = isRtl ? 'pr-[80px]' : 'pl-[80px]';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 h-16">
          <div className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                <img src="/logo.ico" alt="Logo" className="h-6 w-6 object-contain" />
              </div>
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <h1 className="font-bold text-lg">{t('nav_brand')} Tchad</h1>
                <p className="text-xs text-muted-foreground">{t('inseed_platform')}</p>
              </div>
            </div>
          </div>

          <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <LanguageSwitcher />
            <div className={`hidden md:block ${isRtl ? 'text-left ml-2 border-r pr-4' : 'text-right mr-2 border-l pl-4'}`}>
              <p className="text-sm font-medium">{user?.full_name || t('dashboard_researcher')}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className={`h-5 w-5 ${isRtl ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex relative">
        <ResearcherSidebar />

        <main className={`flex-1 ${mainPadding} transition-all duration-300`}>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
