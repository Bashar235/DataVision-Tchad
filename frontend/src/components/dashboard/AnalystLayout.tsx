import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import AnalystSidebar from "./AnalystSidebar";
import AnalystHeader from "./AnalystHeader";
import { useLanguage } from "@/contexts/LanguageContext";

const AnalystLayout = () => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const { isRtl } = useLanguage();

    // Trigger map resize when sidebar toggles
    useEffect(() => {
        window.dispatchEvent(new Event('resize'));
        const timer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 300);
        return () => clearTimeout(timer);
    }, [isCollapsed]);

    return (
        <div className="flex h-screen w-full bg-background overflow-hidden">
            {/* Sidebar */}
            <AnalystSidebar isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} />

            <div className="flex-1 flex flex-col h-full relative transition-all duration-300">
                {/* Header */}
                <AnalystHeader />

                <main className="flex-1 overflow-auto relative ps-6">
                    <Outlet context={{ isSidebarHovered: isCollapsed }} />
                </main>
            </div>
        </div>
    );
};

export default AnalystLayout;
