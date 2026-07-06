const API_BASE = import.meta.env.VITE_API_URL;

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// Token is kept in sessionStorage (cleared when the browser tab closes).
// This prevents XSS scripts from reading the token via localStorage,
// which persists indefinitely across sessions.
let _memToken: string | null = sessionStorage.getItem("_aft") ?? null;

function getToken(): string | null {
  return _memToken;
}

function setToken(token: string): void {
  _memToken = token;
  sessionStorage.setItem("_aft", token);
}

function removeToken(): void {
  _memToken = null;
  sessionStorage.removeItem("_aft");
  // Clear any legacy localStorage tokens from older sessions
  localStorage.removeItem("token");
}

// One CSRF token per session — generated once, sent on every mutating request.
// The backend should validate X-CSRF-Token matches the session's expected value.
function getCsrfToken(): string {
  let t = sessionStorage.getItem("_cst");
  if (!t) {
    t = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    sessionStorage.setItem("_cst", t);
  }
  return t;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const method = (options.method ?? "GET").toUpperCase();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (MUTATING_METHODS.has(method)) {
    headers["X-CSRF-Token"] = getCsrfToken();
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  let data: any = {};
  try {
    const text = await response.text();
    if (text) data = JSON.parse(text);
  } catch {}

  if (!response.ok) {
    if (response.status === 401) {
      removeToken();
      localStorage.removeItem("user");
      window.location.href = "/login";
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
};

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
};

export const justdialSyncAPI = {
  sync: () =>
    request<{ success: boolean; message: string; data: any }>(
      "/leads/justdial/sync",
      { method: "POST", body: JSON.stringify({}) },
    ),
  getStatus: () =>
    request<{ success: boolean; data: any }>("/leads/justdial/status"),
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
    const token = getToken();
    return fetch(`${API_BASE}/whatsapp/upload-media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRF-Token": getCsrfToken(),
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

export { getToken, setToken, removeToken, ApiError };
