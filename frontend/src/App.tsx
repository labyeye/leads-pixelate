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
import ActivityLogPage from "./pages/ActivityLogPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import OnboardingPage from "./pages/OnboardingPage";
import BillingPage from "./pages/BillingPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import ReportsPage from "./pages/ReportsPage";
import ClientsPage from "./pages/ClientsPage";
import QuotationsPage from "./pages/QuotationsPage";
import ProductsPage from "./pages/ProductsPage";
import ServicesPage from "./pages/ServicesPage";
import ConsolePage from "./pages/ConsolePage";
import WhatsAppInboxPage from "./pages/WhatsAppInboxPage";
import WhatsAppLogsPage from "./pages/WhatsAppLogsPage";
import WhatsAppSetupPage from "./pages/WhatsAppSetupPage";
import WhatsappMessagingPage from "./pages/WhatsappMessagingPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import SocialMediaPlannerPage from "./pages/SocialMediaPlannerPage";
import SocialAutopilotPage from "./pages/SocialAutopilotPage";
import SocialAutopilotSetupPage from "./pages/SocialAutopilotSetupPage";
import SocialAutopilotReportPage from "./pages/SocialAutopilotReportPage";
import AIUsagePage from "./pages/AIUsagePage";
import LinkedInCampaignsPage from "./pages/LinkedInCampaignsPage";
import GoogleAdsCampaignsPage from "./pages/GoogleAdsCampaignsPage";
import GoogleAdsPlaceholderPage from "./pages/GoogleAdsPlaceholderPage";
import FacebookDashboardPage from "./pages/FacebookDashboardPage";
import FacebookAdCampaignsPage from "./pages/FacebookAdCampaignsPage";
import FacebookAdSetsPage from "./pages/FacebookAdSetsPage";
import FacebookAdsPage from "./pages/FacebookAdsPage";
import LinkedInAdsPlaceholderPage from "./pages/LinkedInAdsPlaceholderPage";
import CampaignReportsPage from "./pages/CampaignReportsPage";
import FacebookCampaignManagementPage from "./pages/FacebookCampaignManagementPage";
import LinkedInCampaignManagementPage from "./pages/LinkedInCampaignManagementPage";
import CampaignManagementOverviewPage from "./pages/CampaignManagementOverviewPage";
import AccountSecurityPage from "./pages/AccountSecurityPage";
import CampaignBuilderPage from "./pages/CampaignBuilderPage";
import ApiKeysPage from "./pages/ApiKeysPage";
import SupportPage from "./pages/SupportPage";
import NotFound from "./pages/NotFound";
import { NotificationProvider } from "@/components/ui/Notification";
import logonest from "@/assets/images/Logo.png";    
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
        <div className="w-12 h-12 border-2 border-black flex items-center justify-center nb-shadow animate-bounce">
          <img src={logonest} alt="Logo" className="w-full h-full object-contain"  />
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
        path="/forgot-password"
        element={
          !isAuthenticated ? (
            <ForgotPasswordPage />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/reset-password/:token"
        element={
          !isAuthenticated ? (
            <ResetPasswordPage />
          ) : (
            <Navigate to="/" replace />
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
        path="/activity-log"
        element={
          <ProtectedRoute>
            <ActivityLogPage />
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
        path="/products"
        element={
          <ProtectedRoute>
            <ProductsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/services"
        element={
          <ProtectedRoute>
            <ServicesPage />
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
        path="/whatsapp/campaigns"
        element={
          <ProtectedRoute>
            <WhatsappMessagingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/whatsapp"
        element={<Navigate to="/whatsapp/inbox" replace />}
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
        path="/ai-usage"
        element={
          <ProtectedRoute>
            <AIUsagePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/social-autopilot"
        element={
          <ProtectedRoute>
            <SocialAutopilotPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/social-autopilot/setup"
        element={
          <ProtectedRoute>
            <SocialAutopilotSetupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/social-autopilot/report"
        element={
          <ProtectedRoute>
            <SocialAutopilotReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns"
        element={<Navigate to="/campaigns/facebook" replace />}
      />
      <Route
        path="/account/security"
        element={
          <ProtectedRoute>
            <AccountSecurityPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/facebook"
        element={
          <ProtectedRoute>
            <FacebookDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/facebook/campaigns"
        element={
          <ProtectedRoute>
            <FacebookAdCampaignsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/facebook/adsets"
        element={
          <ProtectedRoute>
            <FacebookAdSetsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/facebook/ads"
        element={
          <ProtectedRoute>
            <FacebookAdsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/facebook/management"
        element={
          <ProtectedRoute>
            <FacebookCampaignManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/linkedin"
        element={
          <ProtectedRoute>
            <LinkedInCampaignsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/linkedin/dashboard"
        element={
          <ProtectedRoute>
            <LinkedInAdsPlaceholderPage title="Dashboard" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/linkedin/campaigns"
        element={
          <ProtectedRoute>
            <LinkedInAdsPlaceholderPage title="Ad Campaigns" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/linkedin/adsets"
        element={
          <ProtectedRoute>
            <LinkedInAdsPlaceholderPage title="Ad Sets" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/linkedin/ads"
        element={
          <ProtectedRoute>
            <LinkedInAdsPlaceholderPage title="Ads" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/linkedin/management"
        element={
          <ProtectedRoute>
            <LinkedInCampaignManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/google"
        element={
          <ProtectedRoute>
            <GoogleAdsCampaignsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/google/dashboard"
        element={
          <ProtectedRoute>
            <GoogleAdsPlaceholderPage title="Dashboard" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/google/campaigns"
        element={
          <ProtectedRoute>
            <GoogleAdsPlaceholderPage title="Ad Campaigns" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/google/adgroups"
        element={
          <ProtectedRoute>
            <GoogleAdsPlaceholderPage title="Ad Groups" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/google/ads"
        element={
          <ProtectedRoute>
            <GoogleAdsPlaceholderPage title="Ads" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/reports"
        element={
          <ProtectedRoute>
            <CampaignReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/management"
        element={
          <ProtectedRoute>
            <CampaignManagementOverviewPage />
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
      <Route
        path="/api-keys"
        element={
          <ProtectedRoute>
            <ApiKeysPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/support"
        element={
          <ProtectedRoute>
            <SupportPage />
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
          <NotificationProvider>
            <AppRoutes />
          </NotificationProvider>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
