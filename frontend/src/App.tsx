import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import LeadsPage from "./pages/LeadsPage";
import VisitCalendarPage from "./pages/VisitCalendarPage";
import FollowupCalendarPage from "./pages/FollowupCalendarPage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OnboardingPage from "./pages/OnboardingPage";
import BillingPage from "./pages/BillingPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import ReportsPage from "./pages/ReportsPage";
import ClientsPage from "./pages/ClientsPage";
import QuotationsPage from "./pages/QuotationsPage";
import ConsolePage from "./pages/ConsolePage";
import WhatsAppInboxPage from "./pages/WhatsAppInboxPage";
import WhatsAppLogsPage from "./pages/WhatsAppLogsPage";
import WhatsAppSetupPage from "./pages/WhatsAppSetupPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import SocialMediaPlannerPage from "./pages/SocialMediaPlannerPage";
import CampaignsPage from "./pages/CampaignsPage";
import CampaignBuilderPage from "./pages/CampaignBuilderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-[#024BAB] border-2 border-black flex items-center justify-center nb-shadow animate-bounce">
          <span className="text-black font-display font-bold text-lg">L</span>
        </div>
        <p className="text-sm font-medium text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, tenant } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isPaid = tenant && tenant.plan !== "trial";
  if (!isPaid) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading, tenant } = useAuth();

  if (isLoading) return <LoadingScreen />;

  const isPaid = isAuthenticated && tenant && tenant.plan !== "trial";

  return (
    <Routes>
      <Route
        path="/login"
        element={
          !isAuthenticated ? (
            <LoginPage />
          ) : isPaid ? (
            <Navigate to="/" replace />
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />
      <Route
        path="/register"
        element={
          !isAuthenticated ? (
            <RegisterPage />
          ) : isPaid ? (
            <Navigate to="/" replace />
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />
      <Route
        path="/onboarding"
        element={
          !isAuthenticated ? (
            <Navigate to="/register" replace />
          ) : isPaid ? (
            <Navigate to="/" replace />
          ) : (
            <OnboardingPage />
          )
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <LeadsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/visit-calendar"
        element={
          <ProtectedRoute>
            <VisitCalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/followup-calendar"
        element={
          <ProtectedRoute>
            <FollowupCalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <ProtectedRoute>
            <IntegrationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute>
            <BillingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <ClientsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotations"
        element={
          <ProtectedRoute>
            <QuotationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/console"
        element={
          <ProtectedRoute>
            <ConsolePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/whatsapp/inbox"
        element={
          <ProtectedRoute>
            <WhatsAppInboxPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/whatsapp/logs"
        element={
          <ProtectedRoute>
            <WhatsAppLogsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/whatsapp/setup"
        element={
          <ProtectedRoute>
            <WhatsAppSetupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/social-planner"
        element={
          <ProtectedRoute>
            <SocialMediaPlannerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns"
        element={
          <ProtectedRoute>
            <CampaignsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/new"
        element={
          <ProtectedRoute>
            <CampaignBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/:id/edit"
        element={
          <ProtectedRoute>
            <CampaignBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route path="/payment-success" element={<PaymentSuccessPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
