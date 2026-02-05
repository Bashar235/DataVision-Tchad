import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { NavLink } from "@/components/NavLink";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
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
    Settings,
    Users
} from "lucide-react";

const AdminSidebar = () => {
    const { t, isRtl } = useLanguage();
    const navigate = useNavigate();
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

    const handleLogout = () => {
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userEmail');
        navigate('/login');
    };

    const menuItems = [
        { icon: LayoutDashboard, label: t('side_nav_overview'), path: "/admin/dashboard" },
        { icon: BarChart3, label: t('side_nav_analytics'), path: "/admin/visualization" },
        { icon: Users, label: t('side_nav_users'), path: "/admin/users" },
        { icon: Shield, label: t('side_nav_security'), path: "/admin/security" },
        { icon: Database, label: t('side_nav_data_management'), path: "/admin/data-management" },
        { icon: FileText, label: t('side_nav_reports'), path: "/admin/reports" },
    ];

    const analyticsItems = [];
    const reportItems = [];

    const sidebarWidth = isHovered ? 'w-[260px]' : 'w-[80px]';
    const sidebarPosition = isRtl ? 'right-0 border-l' : 'left-0 border-r';
    const animationClass = isRtl ? 'slide-in-from-right' : 'slide-in-from-left';
    const shadowStyle = isHovered
        ? (isRtl ? '-10px 0 30px -10px rgba(0,0,0,0.5)' : '10px 0 30px -10px rgba(0,0,0,0.5)')
        : 'none';

    return (
        <aside
            className={`fixed ${sidebarPosition} top-0 h-full ${sidebarWidth} bg-card/80 backdrop-blur-xl border-white/10 transition-all duration-300 ease-in-out flex flex-col z-50 overflow-hidden shadow-2xl animate-in ${animationClass} will-change-[width]`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
                boxShadow: shadowStyle
            }}
        >
            {/* Header */}
            <div className="flex items-center h-16 shrink-0">
                <div className="flex items-center w-full px-4 gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 mx-auto transition-all duration-300 overflow-hidden">
                        <img src="/logo.ico" alt="Logo" className="w-8 h-8 object-contain" />
                    </div>
                    <span className={`font-bold text-lg text-primary whitespace-nowrap transition-all duration-300 ${isHovered ? 'opacity-100 translate-x-0' : `opacity-0 ${isRtl ? 'translate-x-4' : '-translate-x-4'} h-0 overflow-hidden`}`}>
                        {t('side_nav_admin_panel')}
                    </span>
                </div>
            </div>

            <Separator className="opacity-10" />

            <ScrollArea className="flex-1 overflow-x-hidden">
                <nav className="py-6 flex flex-col items-center">
                    {/* Main Menu */}
                    <div className="w-full space-y-2">
                        <p className={`px-6 text-[10px] font-bold text-primary/60 uppercase tracking-widest transition-all duration-300 ${isHovered ? 'opacity-100 mb-2' : 'opacity-0 h-0 overflow-hidden'}`}>
                            {t('side_nav_admin_tools')}
                        </p>
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className="group flex items-center h-12 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200"
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
                    </div>

                    <div className="w-full px-6 py-4">
                        <Separator className="opacity-10" />
                    </div>

                    {/* Analytics */}
                    <div className="w-full space-y-2">
                        <p className={`px-6 text-[10px] font-bold text-primary/60 uppercase tracking-widest transition-all duration-300 ${isHovered ? 'opacity-100 mb-2' : 'opacity-0 h-0 overflow-hidden'}`}>
                            {t('side_nav_analytics')}
                        </p>
                        {analyticsItems.map((item: any) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className="group flex items-center h-12 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200"
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
                    </div>
                </nav>
            </ScrollArea>

            <Separator className="opacity-10" />

            {/* Logout */}
            <div className="p-0">
                <button
                    onClick={handleLogout}
                    className="w-full group flex items-center h-12 rounded-xl text-destructive hover:bg-destructive/10 transition-all duration-200"
                >
                    <div className="w-[80px] h-full flex items-center justify-center shrink-0">
                        <LogOut className={`w-6 h-6 transition-transform duration-200 group-hover:scale-110 ${isRtl ? 'rotate-180' : ''}`} />
                    </div>
                    <span className={`font-medium transition-all duration-300 ${isHovered ? 'opacity-100 translate-x-0' : `opacity-0 ${isRtl ? 'translate-x-4' : '-translate-x-4'} w-0 overflow-hidden`}`}>
                        {t('side_nav_logout')}
                    </span>
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
