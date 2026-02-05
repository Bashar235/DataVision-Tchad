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
import Visualization from "@/pages/admin/Visualization";
import AnalystDashboard from "@/pages/analyst/AnalystDashboard";
import PredictiveAnalysis from "@/pages/analyst/PredictiveAnalysis";
import Visualizations from "@/pages/analyst/Visualizations";
import DataImport from "@/pages/analyst/DataImport";
import AnalystDataCleaning from "@/pages/analyst/DataCleaning";
import AnalystDatabase from "@/pages/analyst/Database";
import Reports from "@/pages/admin/Reports";
import GenerateReport from "@/pages/analyst/GenerateReport";
import PreviousReports from "@/pages/analyst/PreviousReports";
import ExportData from "@/pages/analyst/ExportData";
import Profile from "@/pages/analyst/Profile";
import DataHealth from "@/pages/analyst/DataHealth";
import OTPVerification from "@/pages/OTPVerification";
import UserManagement from "@/pages/admin/UserManagement";
import AdminSecurity from "@/pages/admin/Security";

// Layouts and Nested Pages
import ResearcherLayout from "@/components/dashboard/ResearcherLayout";
import ResearcherOverview from "@/pages/researcher/dashboard/Overview";
import ResearcherVisualization from "@/pages/researcher/dashboard/Visualization";
import ResearcherAnalytics from "@/pages/researcher/dashboard/Analytics";
import ResearcherReports from "@/pages/researcher/dashboard/Reports";
import ResearcherExport from "@/pages/researcher/dashboard/Export";
import ResearcherProfile from "@/pages/researcher/dashboard/Profile";


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

      {/* Admin Routes - Protected */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin', 'administrator']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/dashboard" element={
        <ProtectedRoute allowedRoles={['admin', 'administrator']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/visualization" element={
        <ProtectedRoute allowedRoles={['admin', 'administrator']}>
          <div className="flex bg-slate-50 min-h-screen">
            <Visualization />
          </div>
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
      <Route path="/admin/cleaning" element={<Navigate to="/admin/data-management" replace />} />
      <Route path="/admin/database" element={<Navigate to="/admin/data-management" replace />} />
      <Route path="/admin/data-management" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/reports" element={
        <ProtectedRoute allowedRoles={['admin', 'administrator']}>
          <Reports />
        </ProtectedRoute>
      } />

      {/* Analyst Routes - Protected */}
      <Route path="/analyst" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <AnalystDashboard />
        </ProtectedRoute>
      } />
      <Route path="/analyst/dashboard" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <AnalystDashboard />
        </ProtectedRoute>
      } />
      <Route path="/analyst/predictive" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <PredictiveAnalysis />
        </ProtectedRoute>
      } />
      <Route path="/analyst/visualizations" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <Visualizations />
        </ProtectedRoute>
      } />
      <Route path="/analyst/import" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <DataImport />
        </ProtectedRoute>
      } />
      <Route path="/analyst/cleaning" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <AnalystDataCleaning />
        </ProtectedRoute>
      } />
      <Route path="/analyst/database" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <AnalystDatabase />
        </ProtectedRoute>
      } />
      <Route path="/analyst/report" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <GenerateReport />
        </ProtectedRoute>
      } />
      <Route path="/analyst/reports" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <PreviousReports />
        </ProtectedRoute>
      } />
      <Route path="/analyst/export" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <ExportData />
        </ProtectedRoute>
      } />
      <Route path="/analyst/profile" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <Profile />
        </ProtectedRoute>
      } />
      <Route path="/analyst/health" element={
        <ProtectedRoute allowedRoles={['analyst']}>
          <DataHealth />
        </ProtectedRoute>
      } />
      <Route path="/analyst/*" element={<Navigate to="/analyst" replace />} />

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
