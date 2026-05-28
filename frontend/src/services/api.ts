const API_BASE = import.meta.env.VITE_API_URL;

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

function setToken(token: string): void {
  localStorage.setItem("token", token);
}

function removeToken(): void {
  localStorage.removeItem("token");
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  const data = await response.json();

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
};

export const indiamartAPI = {
  sync: (params?: { start_time?: string; end_time?: string }) =>
    request<{ success: boolean; message: string; data: any }>(
      "/leads/indiamart/sync",
      {
        method: "POST",
        body: JSON.stringify(params || {}),
      },
    ),
  getStatus: () =>
    request<{ success: boolean; data: any }>("/leads/indiamart/status"),
};

export const dashboardAPI = {
  getStats: () => request<{ success: boolean; data: any }>("/dashboard/stats"),
};

// Products are used internally by Leads (interested products field)
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
};

export const billingAPI = {
  getPlans: () => request<{ success: boolean; data: any }>("/billing/plans"),
  getSubscription: () =>
    request<{ success: boolean; data: any }>("/billing/subscription"),
  createOrder: (plan: string, billingCycle: "monthly" | "yearly") =>
    request<{ success: boolean; data: any }>("/billing/create-order", {
      method: "POST",
      body: JSON.stringify({ plan, billingCycle }),
    }),
  verifyPayment: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan: string;
    billingCycle: string;
  }) =>
    request<{ success: boolean; message: string; data: any }>(
      "/billing/verify-payment",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
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
  connectPage: (pageId: string, selectedFormIds: string[]) =>
    request<{ success: boolean; message: string; data: any }>(
      "/facebook/connect-page",
      {
        method: "POST",
        body: JSON.stringify({ pageId, selectedFormIds }),
      },
    ),
  getConnectedPages: () =>
    request<{
      success: boolean;
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
};

export const settingsAPI = {
  get: () => request<{ success: boolean; data: any }>("/settings"),
  update: (settings: any) =>
    request<{ success: boolean; data: any }>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};

export { getToken, setToken, removeToken, ApiError };
