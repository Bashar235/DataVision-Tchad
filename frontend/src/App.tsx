import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Pages
import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import AdminDashboard from "@/pages/admin/Dashboard";
import SystemInfrastructure from "@/pages/admin/SystemInfrastructure";
import TwoFALogin from "@/pages/TwoFALogin";
import AnalystDashboard from "@/pages/analyst/AnalystDashboard";
import PredictiveAnalysis from "@/pages/analyst/PredictiveAnalysis";
import Visualizations from "@/pages/analyst/Visualizations";
import DataImport from "@/pages/analyst/DataImport";
import AnalystDataCleaning from "@/pages/analyst/DataCleaning";
import AnalystDatabase from "@/pages/analyst/Database";
import GenerateReport from "@/pages/analyst/GenerateReport";
import PreviousReports from "@/pages/analyst/PreviousReports";
import ExportData from "@/pages/analyst/ExportData";
import Profile from "@/pages/analyst/Profile";
import DataHealth from "@/pages/analyst/DataHealth";
import AnalystSpatialAudit from "@/pages/analyst/AnalystSpatialAudit";
import AnalystMaps from "@/pages/analyst/AnalystMaps";
import CleaningConsole from "@/pages/analyst/CleaningConsole";
import OTPVerification from "@/pages/OTPVerification";
import UserManagement from "@/pages/admin/UserManagement";
import AdminSecurity from "@/pages/admin/Security";
import StrategicOversight from "@/pages/admin/StrategicOversight";
import AnalystLayout from "@/components/dashboard/AnalystLayout";

// Layouts and Nested Pages
import ResearcherLayout from "@/components/dashboard/ResearcherLayout";
import ResearcherOverview from "@/pages/researcher/dashboard/Overview";
import ResearcherVisualization from "@/pages/researcher/dashboard/Visualization";
import ResearcherAnalytics from "@/pages/researcher/dashboard/Analytics";
import ResearcherReports from "@/pages/researcher/dashboard/Reports";
import ResearcherExport from "@/pages/researcher/dashboard/Export";
import ResearcherProfile from "@/pages/researcher/dashboard/Profile";
import ResearcherGeospatial from "@/pages/researcher/ResearcherGeospatial";
import ResearcherMaps from "@/pages/researcher/ResearcherMaps";
import Scenarios from "@/pages/researcher/Scenarios";


import { useSessionTimeout } from "@/hooks/useSessionTimeout";

const queryClient = new QueryClient();

const AppContent = () => {
  useSessionTimeout(15);
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verify-otp" element={<OTPVerification />} />
      <Route path="/auth/2fa" element={<TwoFALogin />} />

      {/* Admin Routes - Protected */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin', 'administrator']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      {/* Add an index-like route for dashboard specifically */}
      <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/infrastructure" element={
        <ProtectedRoute allowedRoles={['admin', 'administrator']}>
          <SystemInfrastructure />
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute allowedRoles={['admin', 'administrator']}>
          <UserManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/security" element={
        <ProtectedRoute allowedRoles={['admin', 'administrator']}>
          <AdminSecurity />
        </ProtectedRoute>
      } />

      {/* REDIRECTS: Move these here, outside of the researcher block */}
      <Route path="/admin/predictive" element={<Navigate to="/admin?tab=oversight" replace />} />
      <Route path="/admin/oversight" element={<Navigate to="/admin?tab=oversight" replace />} />
      <Route path="/admin/cleaning" element={<Navigate to="/admin/data-management" replace />} />
      <Route path="/admin/database" element={<Navigate to="/admin/data-management" replace />} />
      <Route path="/admin/reports" element={<Navigate to="/admin?tab=reports" replace />} />
      <Route path="/admin/data-management" element={<Navigate to="/admin" replace />} />

      {/* Analyst Routes - Protected */}
      <Route path="/analyst" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <AnalystLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/analyst/dashboard" replace />} />
        <Route path="dashboard" element={<AnalystDashboard />} />
        <Route path="predictive" element={<PredictiveAnalysis />} />
        <Route path="visualizations" element={<Visualizations />} />
        <Route path="import" element={<DataImport />} />
        <Route path="cleaning" element={<AnalystDataCleaning />} />
        <Route path="database" element={<AnalystDatabase />} />
        <Route path="report" element={<GenerateReport />} />
        <Route path="reports" element={<PreviousReports />} />
        <Route path="export" element={<ExportData />} />
        <Route path="profile" element={<Profile />} />
        <Route path="health" element={<DataHealth />} />
        <Route path="spatial-audit" element={<AnalystSpatialAudit />} />
        <Route path="maps" element={<AnalystMaps />} />
        <Route path="cleaning-console/:id" element={<CleaningConsole />} />
        <Route path="*" element={<Navigate to="/analyst/dashboard" replace />} />
      </Route>

      {/* Researcher Routes - Protected */}
      <Route path="/researcher" element={
        <ProtectedRoute allowedRoles={['researcher']}>
          <ResearcherLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/researcher/overview" replace />} />
        <Route path="overview" element={<ResearcherOverview />} />
        <Route path="visualization" element={<ResearcherVisualization />} />
        <Route path="analytics" element={<ResearcherAnalytics />} />
        <Route path="reports" element={<ResearcherReports />} />
        <Route path="export" element={<ResearcherExport />} />
        <Route path="profile" element={<ResearcherProfile />} />
        <Route path="geospatial" element={<ResearcherGeospatial />} />
        <Route path="maps" element={<ResearcherMaps />} />
        <Route path="scenarios" element={<Scenarios />} />
        {/* Deleted the /admin/... redirects from here as they caused the crash */}
        <Route path="*" element={<Navigate to="/researcher/overview" replace />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppContent />
          </TooltipProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
