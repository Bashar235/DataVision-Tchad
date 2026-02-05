import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import {
    BarChart3,
    TrendingUp,
    FileText,
    Download,
    User,
    LayoutDashboard,
    Database
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const ResearcherSidebar = () => {
    const { t, isRtl } = useLanguage();
    const [isHovered, setIsHovered] = useState(false);
    const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        const timeout = setTimeout(() => {
            setIsHovered(false);
        }, 200);
        setHoverTimeout(timeout);
    };

    const navItems = [
        { icon: LayoutDashboard, label: t('side_nav_overview'), path: "/researcher" },
        { icon: BarChart3, label: t('side_nav_visualizations'), path: "/researcher/visualization" },
        { icon: TrendingUp, label: t('side_nav_predictive_analytics'), path: "/researcher/analytics" },
        { icon: FileText, label: t('side_nav_reports'), path: "/researcher/reports" },
        { icon: Download, label: t('side_nav_export_data'), path: "/researcher/export" },
    ];

    const sidebarWidth = isHovered ? 'w-[260px]' : 'w-[80px]';
    const sidebarPosition = isRtl ? 'right-0 border-l' : 'left-0 border-r';
    const animationClass = isRtl ? 'slide-in-from-right' : 'slide-in-from-left';
    const shadowStyle = isHovered
        ? (isRtl ? '-10px 0 30px -10px rgba(0,0,0,0.5)' : '10px 0 30px -10px rgba(0,0,0,0.5)')
        : 'none';

    return (
        <aside
            className={`fixed ${sidebarPosition} top-16 h-[calc(100vh-4rem)] bg-card/80 backdrop-blur-xl border-white/10 transition-all duration-300 ease-in-out z-40 overflow-hidden shadow-2xl animate-in ${animationClass} will-change-[width] ${sidebarWidth}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                boxShadow: shadowStyle
            }}
        >
            <ScrollArea className="h-full">
                <nav className="py-6 flex flex-col items-center w-full">
                    <p className={`px-6 text-[10px] font-bold text-primary/60 uppercase tracking-widest transition-all duration-300 w-full ${isHovered ? 'opacity-100 mb-2' : 'opacity-0 h-0 overflow-hidden'}`}>
                        {t('side_nav_researcher_panel')}
                    </p>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === "/researcher"}
                            className="group flex items-center w-full h-12 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200"
                            activeClassName="bg-primary/20 text-primary shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]"
                        >
                            <div className="w-[80px] h-full flex items-center justify-center shrink-0">
                                <item.icon className="w-6 h-6 transition-transform duration-200 group-hover:scale-110" />
                            </div>
                            <span className={`font-medium whitespace-nowrap transition-all duration-300 ${isHovered ? 'opacity-100 translate-x-0' : `opacity-0 ${isRtl ? 'translate-x-4' : '-translate-x-4'} w-0 overflow-hidden`}`}>
                                {item.label}
                            </span>
                        </NavLink>
                    ))}

                    <div className="w-full px-6 py-4">
                        <Separator className="opacity-10" />
                    </div>

                    <NavLink
                        to="/researcher/profile"
                        className="group flex items-center w-full h-12 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200"
                        activeClassName="bg-primary/20 text-primary shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]"
                    >
                        <div className="w-[80px] h-full flex items-center justify-center shrink-0">
                            <User className="w-6 h-6 transition-transform duration-200 group-hover:scale-110" />
                        </div>
                        <span className={`font-medium whitespace-nowrap transition-all duration-300 ${isHovered ? 'opacity-100 translate-x-0' : `opacity-0 ${isRtl ? 'translate-x-4' : '-translate-x-4'} w-0 overflow-hidden`}`}>
                            {t('side_nav_my_profile')}
                        </span>
                    </NavLink>
                </nav>
            </ScrollArea>
        </aside>
    );
};

export default ResearcherSidebar;
