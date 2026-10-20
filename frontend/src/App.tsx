import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUsageTracker } from "@/hooks/useUsageTracker";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const LeadsPage = lazy(() => import("./pages/LeadsPage"));
const VisitCalendarPage = lazy(() => import("./pages/VisitCalendarPage"));
const FollowupCalendarPage = lazy(() => import("./pages/FollowupCalendarPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const ActivityLogPage = lazy(() => import("./pages/ActivityLogPage"));
const TrashPage = lazy(() => import("./pages/TrashPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const QuotationsPage = lazy(() => import("./pages/QuotationsPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const PriceBooksPage = lazy(() => import("./pages/PriceBooksPage"));
const TradeDocumentsPage = lazy(() => import("./pages/TradeDocumentsPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const ConsolePage = lazy(() => import("./pages/ConsolePage"));
const WhatsAppInboxPage = lazy(() => import("./pages/WhatsAppInboxPage"));
const WhatsAppLogsPage = lazy(() => import("./pages/WhatsAppLogsPage"));
const WhatsAppSetupPage = lazy(() => import("./pages/WhatsAppSetupPage"));
const WhatsappMessagingPage = lazy(() => import("./pages/WhatsappMessagingPage"));
const DocumentVaultPage = lazy(() => import("./pages/DocumentVaultPage"));
const PaymentSuccessPage = lazy(() => import("./pages/PaymentSuccessPage"));
const SocialMediaPlannerPage = lazy(() => import("./pages/SocialMediaPlannerPage"));
const SocialAutopilotPage = lazy(() => import("./pages/SocialAutopilotPage"));
const SocialAutopilotSetupPage = lazy(() => import("./pages/SocialAutopilotSetupPage"));
const SocialAutopilotReportPage = lazy(() => import("./pages/SocialAutopilotReportPage"));
const AIUsagePage = lazy(() => import("./pages/AIUsagePage"));
const LinkedInCampaignsPage = lazy(() => import("./pages/LinkedInCampaignsPage"));
const GoogleAdsCampaignsPage = lazy(() => import("./pages/GoogleAdsCampaignsPage"));
const GoogleAdsPlaceholderPage = lazy(() => import("./pages/GoogleAdsPlaceholderPage"));
const FacebookDashboardPage = lazy(() => import("./pages/FacebookDashboardPage"));
const FacebookAdCampaignsPage = lazy(() => import("./pages/FacebookAdCampaignsPage"));
const FacebookAdSetsPage = lazy(() => import("./pages/FacebookAdSetsPage"));
const FacebookAdsPage = lazy(() => import("./pages/FacebookAdsPage"));
const LinkedInAdsPlaceholderPage = lazy(() => import("./pages/LinkedInAdsPlaceholderPage"));
const CampaignReportsPage = lazy(() => import("./pages/CampaignReportsPage"));
const FacebookCampaignManagementPage = lazy(() => import("./pages/FacebookCampaignManagementPage"));
const LinkedInCampaignManagementPage = lazy(() => import("./pages/LinkedInCampaignManagementPage"));
const CampaignManagementOverviewPage = lazy(() => import("./pages/CampaignManagementOverviewPage"));
const AccountSecurityPage = lazy(() => import("./pages/AccountSecurityPage"));
const CampaignBuilderPage = lazy(() => import("./pages/CampaignBuilderPage"));
const ApiKeysPage = lazy(() => import("./pages/ApiKeysPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
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
          <img
            src={logonest}
            alt="Logo"
            className="w-full h-full object-contain"
          />
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
  useUsageTracker();

  if (isLoading) return <LoadingScreen />;

  const isPaid = isAuthenticated && tenant && tenant.plan !== "trial";

  return (
    <Suspense fallback={<LoadingScreen />}>
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
          !isAuthenticated ? <ResetPasswordPage /> : <Navigate to="/" replace />
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
        path="/trash"
        element={
          <ProtectedRoute>
            <TrashPage />
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
        path="/price-books"
        element={
          <ProtectedRoute>
            <PriceBooksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales-orders"
        element={
          <ProtectedRoute>
            <TradeDocumentsPage kind="sales_order" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase-orders"
        element={
          <ProtectedRoute>
            <TradeDocumentsPage kind="purchase_order" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices"
        element={
          <ProtectedRoute>
            <TradeDocumentsPage kind="invoice" />
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
        path="/documents"
        element={
          <ProtectedRoute>
            <DocumentVaultPage />
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
    </Suspense>
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
