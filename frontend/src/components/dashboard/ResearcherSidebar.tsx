import { NavLink } from "@/components/NavLink";
import {
    BarChart3,
    TrendingUp,
    FileText,
    Download,
    User,
    LayoutDashboard,
    Map,
    PieChart,
    BarChart3 as ChartIcon
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface ResearcherSidebarProps {
    isCollapsed: boolean;
    toggleSidebar: () => void;
}

const ResearcherSidebar = ({ isCollapsed, toggleSidebar }: ResearcherSidebarProps) => {
    const { t, isRtl } = useLanguage();

    const navItems = [
        { label: t('side_nav_overview'), icon: LayoutDashboard, path: '/researcher/dashboard' },
        { label: t('side_nav_scenarios'), icon: TrendingUp, path: '/researcher/scenarios' },
        { label: t('side_nav_visualizations'), icon: PieChart, path: '/researcher/visualization' },
        { label: t('maps'), icon: Map, path: "/researcher/maps" },
        { label: t('side_nav_reports'), icon: FileText, path: "/researcher/reports" },
        { label: t('side_nav_export_data'), icon: Download, path: "/researcher/export" },
    ];

    const sidebarWidth = isCollapsed ? 'w-[64px]' : 'w-[280px]';
    const sidebarPosition = 'border-e';

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
                    <p className={`px-4 text-[11px] font-bold text-[#9aa0a6] uppercase tracking-widest mb-2 transition-opacity duration-300 ${isCollapsed ? 'opacity-0 h-0 hidden' : 'opacity-100'}`}>
                        {t('side_nav_researcher_panel')}
                    </p>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === "/researcher"}
                            className={`group flex items-center h-10 rounded-lg text-[#c4c7c5] hover:text-white hover:bg-white/5 transition-all duration-200 relative ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
                            activeClassName="bg-[#3c4043] text-white font-medium shadow-sm"
                        >
                            {/* Active Indicator Bar */}
                            <div className="absolute start-0 rounded-e-full top-2 bottom-2 w-1 bg-primary opacity-0 group-[.active]:opacity-100 transition-opacity" />

                            <div className="flex items-center justify-center shrink-0">
                                <item.icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                            </div>
                            <span className={`ms-3 font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                                {item.label}
                            </span>
                        </NavLink>
                    ))}

                    <div className="w-full px-2 py-2">
                        <Separator className="opacity-10" />
                    </div>

                    <NavLink
                        to="/researcher/profile"
                        className={`group flex items-center h-10 rounded-lg text-[#c4c7c5] hover:text-white hover:bg-white/5 transition-all duration-200 relative ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
                        activeClassName="bg-[#3c4043] text-white font-medium shadow-sm"
                    >
                        {/* Active Indicator Bar */}
                        <div className={`absolute inset-y-2 inset-s-0 w-1 bg-primary rounded-e-full opacity-0 group-[.active]:opacity-100 transition-opacity`} />

                        <div className="flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                        </div>
                        <span className={`ms-3 font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                            {t('side_nav_my_profile')}
                        </span>
                    </NavLink>
                </nav>
            </ScrollArea>
        </aside>
    );
};

export default ResearcherSidebar;
