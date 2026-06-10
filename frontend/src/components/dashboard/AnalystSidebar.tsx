import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  Upload,
  Database,
  FileText,
  FolderOpen,
  Download,
  User,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Map,
  Settings
} from "lucide-react";

interface DashboardSidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

const DashboardSidebar = ({ isCollapsed, toggleSidebar }: DashboardSidebarProps) => {
  const { t, isRtl } = useLanguage();

  const menuItems = [
    { icon: LayoutDashboard, label: t('side_nav_overview'), path: "/analyst" },
    { icon: TrendingUp, label: t('side_nav_predictive_analytics'), path: "/analyst/predictive" },
    { icon: BarChart3, label: t('side_nav_visualizations'), path: "/analyst/visualizations" },
    { icon: Map, label: t('maps'), path: "/analyst/maps" },
    { icon: Upload, label: t('side_nav_data_import'), path: "/analyst/import" },
    { icon: Settings, label: t('side_nav_data_cleaning'), path: "/analyst/cleaning" },
    { icon: Database, label: t('side_nav_imported_files'), path: "/analyst/database" },
    { icon: Shield, label: t('side_nav_productivity_board'), path: "/analyst/health" },
  ];

  const reportItems = [
    { icon: FileText, label: t('side_nav_generate_report'), path: "/analyst/report" },
    { icon: FolderOpen, label: t('side_nav_previous_reports'), path: "/analyst/reports" },
    { icon: Download, label: t('side_nav_export_data'), path: "/analyst/export" },
  ];

  const accountItems = [
    { icon: User, label: t('side_nav_my_profile'), path: "/analyst/profile" },
  ];

  const sidebarWidth = isCollapsed ? 'w-[64px]' : 'w-[280px]';
  const sidebarPosition = isRtl ? 'border-l' : 'border-r';

  return (
    <aside
      className={`relative h-full ${sidebarWidth} bg-[#1e1f20] ${sidebarPosition} border-white/5 transition-[width] duration-300 ease-in-out flex flex-col z-[9999] overflow-hidden shadow-xl shrink-0`}
    >
      {/* Header with Hamburger */}
      <div className="flex items-center h-16 shrink-0 px-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-white hover:bg-white/10 shrink-0"
        >
          <div className="flex flex-col gap-1.5 w-6 items-center justify-center">
            <div className="w-5 h-0.5 bg-current rounded-full" />
            <div className="w-5 h-0.5 bg-current rounded-full" />
            <div className="w-5 h-0.5 bg-current rounded-full" />
          </div>
        </Button>

        <span className={`ms-3 font-bold text-lg text-white whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
          {t('nav_brand')}
        </span>
      </div>

      <Separator className="opacity-10" />

      <ScrollArea className="flex-1 overflow-x-hidden">
        <nav className="py-4 flex flex-col gap-1 px-2">
          {/* Section Label */}
          <div className={`px-4 text-[10px] font-bold text-primary/60 uppercase tracking-widest transition-opacity duration-300 mb-2 ${isCollapsed ? 'opacity-0 h-0 hidden' : 'opacity-100'}`}>
            {t('side_nav_main_menu')}
          </div>

          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={`group flex items-center h-10 rounded-lg text-[#c4c7c5] hover:text-white hover:bg-white/5 transition-all duration-200 relative ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
              activeClassName="bg-[#3c4043] text-white font-medium shadow-sm"
            >
              {/* Active Indicator Bar */}
              <div className={`absolute ${isRtl ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'} top-2 bottom-2 w-1 bg-primary opacity-0 group-[.active]:opacity-100 transition-opacity`} />

              <div className="flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
              </div>
              <span className={`ms-3 font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                {item.label}
              </span>
            </NavLink>
          ))}

          <div className={`my-2 ${isCollapsed ? 'hidden' : 'block'}`}>
            <p className={`px-4 text-[11px] font-bold text-[#9aa0a6] uppercase tracking-widest mb-2 mt-4 transition-opacity duration-300`}>
              {t('side_nav_reports')}
            </p>
          </div>
          {/* Divider for collapsed mode */}
          <div className={`my-2 w-full h-[1px] bg-white/10 ${isCollapsed ? 'block' : 'hidden'}`} />

          {reportItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={`group flex items-center h-10 rounded-lg text-[#c4c7c5] hover:text-white hover:bg-white/5 transition-all duration-200 relative ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
              activeClassName="bg-[#3c4043] text-white font-medium shadow-sm"
            >
              {/* Active Indicator Bar */}
              <div className={`absolute ${isRtl ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'} top-2 bottom-2 w-1 bg-primary opacity-0 group-[.active]:opacity-100 transition-opacity`} />

              <div className="flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
              </div>
              <span className={`ms-3 font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                {item.label}
              </span>
            </NavLink>
          ))}

          <div className={`my-2 ${isCollapsed ? 'hidden' : 'block'}`}>
            <p className={`px-4 text-[11px] font-bold text-[#9aa0a6] uppercase tracking-widest mb-2 mt-4 transition-opacity duration-300`}>
              {t('side_nav_account')}
            </p>
          </div>
          {/* Divider for collapsed mode */}
          <div className={`my-2 w-full h-[1px] bg-white/10 ${isCollapsed ? 'block' : 'hidden'}`} />

          {accountItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={`group flex items-center h-10 rounded-lg text-[#c4c7c5] hover:text-white hover:bg-white/5 transition-all duration-200 relative ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
              activeClassName="bg-[#3c4043] text-white font-medium shadow-sm"
            >
              {/* Active Indicator Bar */}
              <div className={`absolute ${isRtl ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'} top-2 bottom-2 w-1 bg-primary opacity-0 group-[.active]:opacity-100 transition-opacity`} />

              <div className="flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
              </div>
              <span className={`ms-3 font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
};

export default DashboardSidebar;
