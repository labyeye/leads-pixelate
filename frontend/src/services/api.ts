const API_BASE = import.meta.env.VITE_API_URL;

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// Auth is an httpOnly cookie set by the backend — invisible to JS, so there
// is nothing for an XSS payload to read here. Every request just needs to
// carry cookies (credentials: "include") and echo the CSRF cookie back as a
// header (double-submit pattern) on mutating requests.
function readCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function getCsrfToken(): string | null {
  return readCookie("csrf_token");
}

function hasSession(): boolean {
  // access_token is httpOnly (unreadable); csrf_token is set alongside it
  // in the same response, so its presence is a reliable "might be logged in"
  // signal without needing a network round trip.
  return !!readCookie("csrf_token");
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  _retried = false,
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...(options.headers as Record<string, string>),
  };

  if (MUTATING_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  let data: any = {};
  try {
    const text = await response.text();
    if (text) data = JSON.parse(text);
  } catch {}

  if (!response.ok) {
    if (response.status === 401 && endpoint !== "/auth/me" && !_retried) {
      // Access token cookie likely expired (15 min lifetime) — refresh once
      // silently and retry before giving up and bouncing to /login.
      const refreshed = await tryRefresh();
      if (refreshed) {
        return request<T>(endpoint, options, true);
      }
      window.location.href = "/login";
    }
    if (
      response.status === 403 &&
      typeof data.message === "string" &&
      data.message.toLowerCase().includes("subscription")
    ) {
      window.dispatchEvent(new Event("subscription-expired"));
    }
    throw new ApiError(data.message || "Something went wrong", response.status);
  }

  return data;
}

export const authAPI = {
  login: (email: string, password: string) =>
    request<{ success: boolean; data: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (userData: {
    name: string;
    email: string;
    password: string;
    companyName?: string;
    role?: string;
    phone?: string;
    department?: string;
  }) =>
    request<{ success: boolean; data: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  getMe: () => request<{ success: boolean; data: any }>("/auth/me"),

  updateProfile: (updates: {
    name?: string;
    phone?: string;
    department?: string;
  }) =>
    request<{ success: boolean; data: any }>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean; data: any }>("/auth/change-password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  logout: () =>
    request<{ success: boolean; message: string }>("/auth/logout", {
      method: "POST",
    }),

  forgotPassword: (email: string) =>
    request<{ success: boolean; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ success: boolean; message: string }>(
      `/auth/reset-password/${token}`,
      {
        method: "POST",
        body: JSON.stringify({ password }),
      },
    ),
};

export const usersAPI = {
  getAll: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ success: boolean; count: number; data: any[] }>(
      `/users${query}`,
    );
  },
  getById: (id: string) =>
    request<{ success: boolean; data: any }>(`/users/${id}`),
  create: (userData: any) =>
    request<{ success: boolean; data: any }>("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    }),
  update: (id: string, updates: any) =>
    request<{ success: boolean; data: any }>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`/users/${id}`, {
      method: "DELETE",
    }),
  updateAutoAssign: (userIds: string[]) =>
    request<{ success: boolean; message: string }>("/users/auto-assign", {
      method: "POST",
      body: JSON.stringify({ userIds }),
    }),
};

export const leadsAPI = {
  getAll: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{
      success: boolean;
      count: number;
      total: number;
      data: any[];
    }>(`/leads${query}`);
  },
  getById: (id: string) =>
    request<{ success: boolean; data: any }>(`/leads/${id}`),
  create: (leadData: any) =>
    request<{ success: boolean; data: any }>("/leads", {
      method: "POST",
      body: JSON.stringify(leadData),
    }),
  update: (id: string, updates: any) =>
    request<{ success: boolean; data: any }>(`/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`/leads/${id}`, {
      method: "DELETE",
    }),
  addNote: (id: string, text: string) =>
    request<{ success: boolean; data: any }>(`/leads/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  convertToClient: (
    id: string,
    data: { address: string; businessType: string; remarks?: string },
  ) =>
    request<{ success: boolean; data: any; message: string }>(
      `/leads/${id}/convert`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),
  bulkAssign: (leadIds: string[], assignedTo: string) =>
    request<{ success: boolean; updatedCount: number; skippedCount: number }>(
      "/leads/bulk-assign",
      {
        method: "POST",
        body: JSON.stringify({ leadIds, assignedTo }),
      },
    ),
  bulkUpdateStatus: (leadIds: string[], status: string, remarks?: string) =>
    request<{
      success: boolean;
      updatedCount: number;
      skipped: { id: string; name: string; reason: string }[];
    }>("/leads/bulk-status", {
      method: "POST",
      body: JSON.stringify({ leadIds, status, remarks }),
    }),
  bulkEmail: (leadIds: string[], subject: string, message: string) =>
    request<{
      success: boolean;
      sentCount: number;
      skipped: { id: string; name: string; reason: string }[];
    }>("/leads/bulk-email", {
      method: "POST",
      body: JSON.stringify({ leadIds, subject, message }),
    }),
  importBulk: (leads: any[]) =>
    request<{ success: boolean; count: number; message: string }>(
      "/leads/import",
      { method: "POST", body: JSON.stringify({ leads }) },
    ),
  getColumnPreferences: () =>
    request<{ success: boolean; data: Record<string, boolean> }>(
      "/leads/column-preferences",
    ),
  updateColumnPreferences: (columns: Record<string, boolean>) =>
    request<{ success: boolean; data: Record<string, boolean> }>(
      "/leads/column-preferences",
      { method: "PUT", body: JSON.stringify({ columns }) },
    ),
  getSavedViews: () =>
    request<{ success: boolean; data: SavedView[] }>("/leads/saved-views"),
  createSavedView: (name: string, filters: Record<string, any>) =>
    request<{ success: boolean; data: SavedView }>("/leads/saved-views", {
      method: "POST",
      body: JSON.stringify({ name, filters }),
    }),
  updateSavedView: (id: string, updates: Partial<{ name: string; filters: Record<string, any> }>) =>
    request<{ success: boolean; data: SavedView }>(`/leads/saved-views/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
  deleteSavedView: (id: string) =>
    request<{ success: boolean; data: {} }>(`/leads/saved-views/${id}`, {
      method: "DELETE",
    }),
};

export interface SavedView {
  _id: string;
  tenantId: string;
  name: string;
  filters: Record<string, any>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const reportsAPI = {
  getStatusHistory: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ success: boolean; count: number; data: any[] }>(
      `/leads/reports/status-history${query}`,
    );
  },
};

export const tradeindiaSyncAPI = {
  sync: () =>
    request<{ success: boolean; message: string; data: any }>(
      "/leads/tradeindia/sync",
      { method: "POST", body: JSON.stringify({}) },
    ),
  getStatus: () =>
    request<{ success: boolean; data: any }>("/leads/tradeindia/status"),
  connect: (userId: string, profileId: string, apiKey: string, apiUrl: string) =>
    request<{ success: boolean; message: string }>(
      "/leads/tradeindia/connect",
      { method: "POST", body: JSON.stringify({ userId, profileId, apiKey, apiUrl }) },
    ),
  disconnect: () =>
    request<{ success: boolean; message: string }>(
      "/leads/tradeindia/disconnect",
      { method: "POST" },
    ),
};

export const justdialSyncAPI = {
  getStatus: () =>
    request<{ success: boolean; data: any }>("/leads/justdial/status"),
  connect: (apiKey?: string) =>
    request<{ success: boolean; message: string; data: { webhookUrl: string } }>(
      "/leads/justdial/connect",
      { method: "POST", body: JSON.stringify({ apiKey: apiKey || "" }) },
    ),
  disconnect: () =>
    request<{ success: boolean; message: string }>(
      "/leads/justdial/disconnect",
      { method: "POST" },
    ),
};

export const dashboardAPI = {
  getStats: () => request<{ success: boolean; data: any }>("/dashboard/stats"),
};

export const productsAPI = {
  getAll: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ success: boolean; count: number; data: any[] }>(
      `/products${query}`,
    );
  },
  create: (productData: any) =>
    request<{ success: boolean; data: any }>("/products", {
      method: "POST",
      body: JSON.stringify(productData),
    }),
  update: (id: string, productData: any) =>
    request<{ success: boolean; data: any }>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(productData),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/products/${id}`, { method: "DELETE" }),
};

export const billingAPI = {
  getPlans: () => request<{ success: boolean; data: any }>("/billing/plans"),
  getSubscription: () =>
    request<{ success: boolean; data: any }>(`/billing/subscription`),
  getInvoices: () =>
    request<{ success: boolean; data: any[] }>("/billing/invoices"),
  createOrder: (plan: string, billingCycle: "monthly" | "yearly") =>
    request<{
      success: boolean;
      data: {
        orderId: string;
        amount: number;
        currency: string;
        customerEmail: string;
        customerPhone: string;
        customerName: string;
        key: string;
      };
    }>("/billing/razorpay/create-order", {
      method: "POST",
      body: JSON.stringify({ plan, billingCycle }),
    }),
  verifyPayment: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    request<{ success: boolean; message: string; data: any }>(
      "/billing/razorpay/verify",
      {
        method: "POST",
        body: JSON.stringify({
          razorpayOrderId: payload.razorpay_order_id,
          razorpayPaymentId: payload.razorpay_payment_id,
          razorpaySignature: payload.razorpay_signature,
        }),
      },
    ),
  createHdfcOrder: (plan: string, billingCycle: "monthly" | "yearly") =>
    request<{
      success: boolean;
      data: {
        encRequest: string;
        accessCode: string;
        gatewayUrl: string;
        orderId: string;
      };
    }>("/billing/hdfc/create-order", {
      method: "POST",
      body: JSON.stringify({ plan, billingCycle }),
    }),
  cancelSubscription: () =>
    request<{ success: boolean; message: string }>("/billing/cancel", {
      method: "POST",
    }),
};

export const facebookAPI = {
  getAuthUrl: () =>
    request<{ success: boolean; data: { authUrl: string } }>(
      "/facebook/auth-url",
    ),
  getPages: () =>
    request<{
      success: boolean;
      data: Array<{
        id: string;
        name: string;
        category: string;
        picture: string | null;
        fanCount: number;
      }>;
    }>("/facebook/pages"),
  getForms: (pageId: string) =>
    request<{
      success: boolean;
      data: Array<{
        id: string;
        name: string;
        status: string;
        leadsCount: number;
      }>;
    }>(`/facebook/forms?pageId=${pageId}`),
  connectPage: (
    pageId: string,
    selectedFormIds: string[],
    allowedStates: string[] = [],
    defaultAssigneeId: string = "",
  ) =>
    request<{ success: boolean; message: string; data: any }>(
      "/facebook/connect-page",
      {
        method: "POST",
        body: JSON.stringify({
          pageId,
          selectedFormIds,
          allowedStates,
          defaultAssigneeId,
        }),
      },
    ),
  sync: (pageId?: string, since?: string, until?: string) =>
    request<{
      success: boolean;
      message: string;
      data: {
        created: number;
        skipped: number;
        pages?: Array<{
          pageName: string;
          created: number;
          skipped: number;
          error?: string;
        }>;
      };
    }>("/facebook/sync", {
      method: "POST",
      body: JSON.stringify({ pageId, since, until }),
    }),
  getConnectedPages: () =>
    request<{
      success: boolean;
      hasToken: boolean;
      data: Array<{
        pageId: string;
        pageName: string;
        selectedFormIds: string[];
        webhookVerified: boolean;
        connectedAt: string;
      }>;
    }>("/facebook/connected-pages"),
  disconnect: (pageId?: string) =>
    request<{ success: boolean; message: string }>("/facebook/disconnect", {
      method: "POST",
      body: JSON.stringify({ pageId }),
    }),
  getMetaCampaigns: () =>
    request<{
      success: boolean;
      count: number;
      data: any[];
      adAccounts: any[];
    }>("/facebook/meta-campaigns"),
  getMetaCampaignInsights: (id: string, datePreset?: string) => {
    const query = datePreset ? `?datePreset=${datePreset}` : "";
    return request<{ success: boolean; data: any }>(
      `/facebook/meta-campaigns/${id}/insights${query}`,
    );
  },
  createCampaign: (data: any) =>
    request<{ success: boolean; data: any }>("/facebook/meta-campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCampaign: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/facebook/meta-campaigns/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteCampaign: (id: string) =>
    request<{ success: boolean; message: string }>(
      `/facebook/meta-campaigns/${id}`,
      { method: "DELETE" },
    ),
  getAdSets: (campaignId: string) =>
    request<{ success: boolean; count: number; data: any[] }>(
      `/facebook/meta-campaigns/${campaignId}/adsets`,
    ),
  createAdSet: (data: any) =>
    request<{ success: boolean; data: any }>("/facebook/adsets", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAdSet: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/facebook/adsets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteAdSet: (id: string) =>
    request<{ success: boolean; message: string }>(`/facebook/adsets/${id}`, {
      method: "DELETE",
    }),
  getAds: (adSetId: string) =>
    request<{ success: boolean; count: number; data: any[] }>(
      `/facebook/adsets/${adSetId}/ads`,
    ),
  createAd: (data: any) =>
    request<{ success: boolean; data: any }>("/facebook/ads", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAd: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/facebook/ads/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteAd: (id: string) =>
    request<{ success: boolean; message: string }>(`/facebook/ads/${id}`, {
      method: "DELETE",
    }),
};

export const googleAdsAPI = {
  getAuthUrl: () =>
    request<{ success: boolean; data: { authUrl: string } }>(
      "/google-ads/auth-url",
    ),
  getAccounts: () =>
    request<{
      success: boolean;
      data: Array<{ id: string; name: string; error?: string }>;
    }>("/google-ads/accounts"),
  getCampaigns: (customerId: string) =>
    request<{
      success: boolean;
      data: Array<{ id: string; name: string; status: string }>;
    }>(`/google-ads/campaigns?customerId=${customerId}`),
  connectAccount: (
    customerId: string,
    customerName: string,
    selectedCampaignIds: string[] = [],
    allowedStates: string[] = [],
    defaultAssigneeId: string = "",
    loginCustomerId: string = "",
  ) =>
    request<{ success: boolean; message: string; data: any }>(
      "/google-ads/connect-account",
      {
        method: "POST",
        body: JSON.stringify({
          customerId,
          customerName,
          selectedCampaignIds,
          allowedStates,
          defaultAssigneeId,
          loginCustomerId,
        }),
      },
    ),
  sync: (customerId?: string, since?: string) =>
    request<{
      success: boolean;
      message: string;
      data: {
        created: number;
        updated: number;
        filtered: number;
        accounts?: Array<{
          customerName: string;
          created: number;
          updated: number;
          filtered: number;
          error?: string;
        }>;
      };
    }>("/google-ads/sync", {
      method: "POST",
      body: JSON.stringify({ customerId, since }),
    }),
  getConnectedAccounts: () =>
    request<{
      success: boolean;
      hasToken: boolean;
      data: Array<{
        customerId: string;
        customerName: string;
        selectedCampaignIds: string[];
        allowedStates: string[];
        connectedAt: string;
        webhookUrl: string;
      }>;
    }>("/google-ads/connected-accounts"),
  disconnect: (customerId?: string) =>
    request<{ success: boolean; message: string }>("/google-ads/disconnect", {
      method: "POST",
      body: JSON.stringify({ customerId }),
    }),
};

export interface LeadEmail {
  _id: string;
  leadId: string;
  userId: { _id: string; name: string; email: string } | string;
  provider: "gmail";
  direction: "outbound" | "inbound";
  from: string;
  to: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  snippet: string;
  sentAt: string;
}

export const emailAPI = {
  getAuthUrl: () =>
    request<{ success: boolean; data: { authUrl: string } }>(
      "/email/gmail/auth-url",
    ),
  getStatus: () =>
    request<{
      success: boolean;
      data: { connected: boolean; emailAddress: string; lastSyncedAt: string | null };
    }>("/email/gmail/status"),
  disconnect: () =>
    request<{ success: boolean; message: string }>("/email/gmail/disconnect", {
      method: "POST",
    }),
  getThread: (leadId: string) =>
    request<{ success: boolean; data: LeadEmail[] }>(`/email/leads/${leadId}`),
  send: (
    leadId: string,
    data: { subject: string; bodyHtml: string; bodyText?: string },
  ) =>
    request<{ success: boolean; data: LeadEmail }>(
      `/email/leads/${leadId}/send`,
      { method: "POST", body: JSON.stringify(data) },
    ),
};

export const clientsAPI = {
  getAll: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{
      success: boolean;
      count: number;
      total: number;
      data: any[];
    }>(`/clients${query}`);
  },
  getById: (id: string) =>
    request<{ success: boolean; data: any }>(`/clients/${id}`),
  create: (data: any) =>
    request<{ success: boolean; data: any }>("/clients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`/clients/${id}`, {
      method: "DELETE",
    }),
};

export const servicesAPI = {
  getAll: () =>
    request<{ success: boolean; count: number; data: any[] }>("/services"),
  getById: (id: string) =>
    request<{ success: boolean; data: any }>(`/services/${id}`),
  create: (data: any) =>
    request<{ success: boolean; data: any }>("/services", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/services/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`/services/${id}`, {
      method: "DELETE",
    }),
};

export const quotationsAPI = {
  getAll: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{
      success: boolean;
      count: number;
      total: number;
      data: any[];
    }>(`/quotations${query}`);
  },
  getById: (id: string) =>
    request<{ success: boolean; data: any }>(`/quotations/${id}`),
  create: (data: any) =>
    request<{ success: boolean; data: any }>("/quotations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/quotations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`/quotations/${id}`, {
      method: "DELETE",
    }),
};

export const settingsAPI = {
  get: () => request<{ success: boolean; data: any }>("/settings"),
  update: (settings: any) =>
    request<{ success: boolean; data: any }>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};

export const indiamartAPI = {
  getStatus: () =>
    request<{ success: boolean; data: any }>("/leads/indiamart/status"),
  connect: (apiKey: string) =>
    request<{ success: boolean; message: string }>("/leads/indiamart/connect", {
      method: "POST",
      body: JSON.stringify({ apiKey }),
    }),
  disconnect: () =>
    request<{ success: boolean; message: string }>(
      "/leads/indiamart/disconnect",
      {
        method: "POST",
      },
    ),
  sync: (body?: { start_time?: string; end_time?: string }) =>
    request<{ success: boolean; message: string; data: any }>(
      "/leads/indiamart/sync",
      { method: "POST", body: JSON.stringify(body || {}) },
    ),
  updateSettings: (assigneeIds: string[]) =>
    request<{ success: boolean; message: string }>(
      "/leads/indiamart/settings",
      { method: "POST", body: JSON.stringify({ assigneeIds }) },
    ),
};

export const whatsappAPI = {
  getStatus: () => request<{ success: boolean; data: any }>("/whatsapp/status"),
  getConfig: () => request<{ success: boolean; data: any }>("/whatsapp/config"),
  setup: (data: { accessToken: string; wabaId?: string }) =>
    request<{ success: boolean; message: string }>("/whatsapp/setup", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  addPhoneNumber: (data: {
    phoneNumberId: string;
    label?: string;
    businessName?: string;
    phoneNumber?: string;
  }) =>
    request<{ success: boolean; message: string; data: any }>(
      "/whatsapp/phone-numbers",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),
  removePhoneNumber: (phoneNumberId: string) =>
    request<{ success: boolean; message: string }>(
      `/whatsapp/phone-numbers/${phoneNumberId}`,
      {
        method: "DELETE",
      },
    ),
  disconnect: () =>
    request<{ success: boolean; message: string }>("/whatsapp/disconnect", {
      method: "POST",
    }),
  syncTemplates: () =>
    request<{ success: boolean; message: string; data: any }>(
      "/whatsapp/templates/sync",
      { method: "POST" },
    ),

  getTemplates: () =>
    request<{ success: boolean; count: number; data: any[] }>(
      "/whatsapp/templates",
    ),
  createTemplate: (data: any) =>
    request<{ success: boolean; data: any }>("/whatsapp/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTemplate: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/whatsapp/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteTemplate: (id: string) =>
    request<{ success: boolean; message: string }>(
      `/whatsapp/templates/${id}`,
      { method: "DELETE" },
    ),

  getCampaigns: () =>
    request<{ success: boolean; count: number; data: any[] }>(
      "/whatsapp/campaigns",
    ),
  getCampaign: (id: string) =>
    request<{ success: boolean; data: any }>(`/whatsapp/campaigns/${id}`),
  createCampaign: (data: any) =>
    request<{ success: boolean; data: any }>("/whatsapp/campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  sendMessage: (data: {
    leadId: string;
    templateId?: string;
    variableMapping?: any[];
    messageType?: string;
    messageText?: string;
    phoneNumberId?: string;
  }) =>
    request<{ success: boolean; data: any }>("/whatsapp/send", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getReplies: () =>
    request<{ success: boolean; count: number; data: any[] }>(
      "/whatsapp/replies",
    ),

  uploadMedia: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const csrf = getCsrfToken();
    return fetch(`${API_BASE}/whatsapp/upload-media`, {
      method: "POST",
      credentials: "include",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      body: formData,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      return data;
    });
  },
};

export const socialAPI = {
  getStats: () => request<{ success: boolean; data: any }>("/social/stats"),
  getAnalytics: () =>
    request<{ success: boolean; data: any }>("/social/analytics"),
  getPosts: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ success: boolean; count: number; data: any[] }>(
      `/social/posts${query}`,
    );
  },
  getPost: (id: string) =>
    request<{ success: boolean; data: any }>(`/social/posts/${id}`),
  createPost: (data: any) =>
    request<{ success: boolean; data: any }>("/social/posts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePost: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/social/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePost: (id: string) =>
    request<{ success: boolean; message: string }>(`/social/posts/${id}`, {
      method: "DELETE",
    }),
  submitPost: (id: string) =>
    request<{ success: boolean; data: any }>(`/social/posts/${id}/submit`, {
      method: "PUT",
    }),
  approvePost: (id: string, note?: string) =>
    request<{ success: boolean; data: any }>(`/social/posts/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify({ note }),
    }),
  rejectPost: (id: string, reason: string) =>
    request<{ success: boolean; data: any }>(`/social/posts/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    }),
  publishPost: (id: string) =>
    request<{ success: boolean; data: any; message: string }>(
      `/social/posts/${id}/publish`,
      { method: "POST" },
    ),
  getAccounts: () =>
    request<{ success: boolean; count: number; data: any[] }>(
      "/social/accounts",
    ),
  connectAccount: (data: any) =>
    request<{ success: boolean; data: any }>("/social/accounts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  disconnectAccount: (id: string) =>
    request<{ success: boolean; message: string }>(`/social/accounts/${id}`, {
      method: "DELETE",
    }),
  getFacebookAuthUrl: () =>
    request<{ success: boolean; data: { authUrl: string } }>(
      "/social/auth/facebook",
    ),
  fetchFacebookPages: (userToken: string) =>
    request<{ success: boolean; data: any[] }>("/social/auth/facebook/pages", {
      method: "POST",
      body: JSON.stringify({ userToken }),
    }),
  importFromIntegration: () =>
    request<{ success: boolean; data: { connected: number } }>(
      "/social/accounts/import-from-integration",
      { method: "POST" },
    ),
};

export const campaignAPI = {
  getAll: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ success: boolean; count: number; data: any[] }>(
      `/campaigns${query}`,
    );
  },
  getById: (id: string) =>
    request<{ success: boolean; data: any }>(`/campaigns/${id}`),
  create: (data: any) =>
    request<{ success: boolean; data: any }>("/campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/campaigns/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`/campaigns/${id}`, {
      method: "DELETE",
    }),
  launch: (id: string) =>
    request<{ success: boolean; data: any; message: string }>(
      `/campaigns/${id}/launch`,
      { method: "POST" },
    ),
  pause: (id: string) =>
    request<{ success: boolean; data: any }>(`/campaigns/${id}/pause`, {
      method: "POST",
    }),
  cancel: (id: string) =>
    request<{ success: boolean; data: any }>(`/campaigns/${id}/cancel`, {
      method: "POST",
    }),
  getStats: () => request<{ success: boolean; data: any }>("/campaigns/stats"),
  resolveAudience: (filters: any) =>
    request<{ success: boolean; data: { count: number; contacts: any[] } }>(
      "/campaigns/resolve-audience",
      { method: "POST", body: JSON.stringify(filters) },
    ),
};

export const activityAPI = {
  getLogs: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{
      success: boolean;
      count: number;
      total: number;
      page: number;
      pages: number;
      data: any[];
    }>(`/activity${query}`);
  },
  getStats: () => request<{ success: boolean; data: any }>("/activity/stats"),
};

export const apiKeysAPI = {
  list: () => request<{ success: boolean; data: any[] }>("/api-keys"),
  generate: (name: string, fields?: any[]) =>
    request<{ success: boolean; data: any }>("/api-keys", {
      method: "POST",
      body: JSON.stringify({ name, fields: fields || [] }),
    }),
  revoke: (id: string) =>
    request<{ success: boolean; message: string }>(`/api-keys/${id}`, {
      method: "DELETE",
    }),
};

export const supportAPI = {
  getAll: (params?: Record<string, string>) => {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ success: boolean; count: number; data: any[] }>(
      `/support${query}`,
    );
  },
  getById: (id: string) =>
    request<{ success: boolean; data: any }>(`/support/${id}`),
  create: (data: { subject: string; description: string; priority?: string }) =>
    request<{ success: boolean; data: any }>("/support", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export { hasSession, getCsrfToken, ApiError };
