import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import ResearcherSidebar from "./ResearcherSidebar";
import ResearcherHeader from "./ResearcherHeader";

const DashboardLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Trigger map resize when sidebar toggles
  useEffect(() => {
    // Wait for the transition to finish or at least start
    window.dispatchEvent(new Event('resize'));
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300); // Match transition duration
    return () => clearTimeout(timer);
  }, [isCollapsed]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <ResearcherSidebar isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} />

      <div className="flex-1 flex flex-col h-full relative transition-all duration-300">
        {/* Header */}
        <ResearcherHeader />

        <main className="flex-1 overflow-auto relative ps-6">
          <Outlet context={{ isSidebarHovered: isCollapsed }} />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
