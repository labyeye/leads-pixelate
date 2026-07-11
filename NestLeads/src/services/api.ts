import storage from '../utils/storage';

export const API_BASE = 'http://10.0.2.2:3500/api'; // Android emulator → localhost

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function getToken(): Promise<string | null> {
  return storage.getItem('token');
}

export async function setToken(token: string): Promise<void> {
  await storage.setItem('token', token);
}

export async function removeToken(): Promise<void> {
  await storage.removeItem('token');
  await storage.removeItem('user');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

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
    throw new ApiError(data.message || 'Something went wrong', response.status);
  }
  return data;
}

export const authAPI = {
  login: (email: string, password: string) =>
    request<{ success: boolean; token: string; data: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => request<{ success: boolean; data: any }>('/auth/me'),
  updateProfile: (updates: any) =>
    request<{ success: boolean; data: any }>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

export const leadsAPI = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ success: boolean; data: any[] }>(`/leads${qs}`);
  },
  getById: (id: string) =>
    request<{ success: boolean; data: any }>(`/leads/${id}`),
  create: (data: any) =>
    request<{ success: boolean; data: any }>('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/leads/${id}`, { method: 'DELETE' }),
  addNote: (id: string, text: string) =>
    request<{ success: boolean; data: any }>(`/leads/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  convertToClient: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/leads/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSavedViews: () =>
    request<{ success: boolean; data: SavedView[] }>('/leads/saved-views'),
  createSavedView: (name: string, filters: Record<string, any>) =>
    request<{ success: boolean; data: SavedView }>('/leads/saved-views', {
      method: 'POST',
      body: JSON.stringify({ name, filters }),
    }),
  deleteSavedView: (id: string) =>
    request<{ success: boolean }>(`/leads/saved-views/${id}`, {
      method: 'DELETE',
    }),
};

export interface SavedView {
  _id: string;
  name: string;
  filters: Record<string, any>;
  createdBy: string;
  createdAt: string;
}

export const clientsAPI = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ success: boolean; data: any[] }>(`/clients${qs}`);
  },
  getById: (id: string) =>
    request<{ success: boolean; data: any }>(`/clients/${id}`),
  create: (data: any) =>
    request<{ success: boolean; data: any }>('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/clients/${id}`, { method: 'DELETE' }),
};

export const quotationsAPI = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ success: boolean; data: any[] }>(`/quotations${qs}`);
  },
  getById: (id: string) =>
    request<{ success: boolean; data: any }>(`/quotations/${id}`),
  create: (data: any) =>
    request<{ success: boolean; data: any }>('/quotations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/quotations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/quotations/${id}`, { method: 'DELETE' }),
};

export const productsAPI = {
  getAll: () => request<{ success: boolean; data: any[] }>('/products'),
  create: (data: any) =>
    request<{ success: boolean; data: any }>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/products/${id}`, { method: 'DELETE' }),
};

export const usersAPI = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ success: boolean; data: any[] }>(`/users${qs}`);
  },
  create: (data: any) =>
    request<{ success: boolean; data: any }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' }),
};

export const campaignsAPI = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ success: boolean; count: number; data: any[] }>(
      `/campaigns${qs}`,
    );
  },
  getById: (id: string) =>
    request<{ success: boolean; data: any }>(`/campaigns/${id}`),
  create: (data: any) =>
    request<{ success: boolean; data: any }>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  launch: (id: string) =>
    request<{ success: boolean; data: any }>(`/campaigns/${id}/launch`, {
      method: 'POST',
    }),
  pause: (id: string) =>
    request<{ success: boolean; data: any }>(`/campaigns/${id}/pause`, {
      method: 'POST',
    }),
  cancel: (id: string) =>
    request<{ success: boolean; data: any }>(`/campaigns/${id}/cancel`, {
      method: 'POST',
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/campaigns/${id}`, { method: 'DELETE' }),
};

export const dashboardAPI = {
  getStats: () => request<{ success: boolean; data: any }>('/dashboard/stats'),
};

export const indiamartAPI = {
  getStatus: () => request<{ success: boolean; data: any }>('/indiamart/status'),
  sync: (body: { start_time?: string; end_time?: string }) =>
    request<{ success: boolean; data: any; message: string }>('/indiamart/sync', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export const facebookAPI = {
  sync: (pageId?: string, since?: string, until?: string) =>
    request<{ success: boolean; data: any; message: string }>('/facebook/sync', {
      method: 'POST',
      body: JSON.stringify({ pageId, since, until }),
    }),
};

export const googleAdsAPI = {
  sync: (customerId?: string, since?: string) =>
    request<{ success: boolean; data: any; message: string }>('/google-ads/sync', {
      method: 'POST',
      body: JSON.stringify({ customerId, since }),
    }),
};

export const tradeindiaSyncAPI = {
  sync: () =>
    request<{ success: boolean; data: any; message: string }>('/tradeindia/sync', {
      method: 'POST',
    }),
};

export const justdialSyncAPI = {
  sync: () =>
    request<{ success: boolean; data: any; message: string }>('/justdial/sync', {
      method: 'POST',
    }),
};

export const deviceAPI = {
  saveFcmToken: (token: string, platform: string) =>
    request<{ success: boolean }>('/device/token', {
      method: 'POST',
      body: JSON.stringify({token, platform}),
    }),
};

export const socialAPI = {
  getStats: () => request<{success: boolean; data: any}>('/social/stats'),
  getPosts: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{success: boolean; data: any[]}>(`/social/posts${qs}`);
  },
  getAccounts: () => request<{success: boolean; data: any[]}>('/social/accounts'),
  createPost: (data: any) =>
    request<{success: boolean; data: any}>('/social/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  approvePost: (id: string, note?: string) =>
    request<{success: boolean; data: any}>(`/social/posts/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({note}),
    }),
  rejectPost: (id: string, reason: string) =>
    request<{success: boolean; data: any}>(`/social/posts/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({reason}),
    }),
  publishPost: (id: string) =>
    request<{success: boolean; data: any; message: string}>(`/social/posts/${id}/publish`, {
      method: 'POST',
    }),
};

export async function uploadFile(fileUri: string, fileName: string, mimeType: string): Promise<string> {
  const token = await getToken();
  const formData = new FormData();
  formData.append('file', {uri: fileUri, name: fileName, type: mimeType} as any);
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Upload failed');
  return data.url;
}

export const whatsappAPI = {
  getConversations: () =>
    request<{ success: boolean; data: any[] }>('/whatsapp/conversations'),
  sendMessage: (phone: string, message: string) =>
    request<{ success: boolean }>('/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    }),
  getStatus: () => request<{success: boolean; data: any}>('/whatsapp/status'),
  getConfig: () => request<{success: boolean; data: any}>('/whatsapp/config'),
  getTemplates: () =>
    request<{success: boolean; data: any[]}>('/whatsapp/templates'),
  getCampaigns: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{success: boolean; data: any[]}>(`/whatsapp/campaigns${qs}`);
  },
  getCampaign: (id: string) =>
    request<{success: boolean; data: any}>(`/whatsapp/campaigns/${id}`),
};

export const apiKeysAPI = {
  list: () => request<{success: boolean; data: any[]}>('/api-keys'),
  generate: (name: string, fields?: any[]) =>
    request<{success: boolean; data: any}>('/api-keys', {
      method: 'POST',
      body: JSON.stringify({name, fields: fields || []}),
    }),
  revoke: (id: string) =>
    request<{success: boolean; message: string}>(`/api-keys/${id}`, {
      method: 'DELETE',
    }),
};

export const supportAPI = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{success: boolean; count: number; data: any[]}>(
      `/support${qs}`,
    );
  },
  getById: (id: string) =>
    request<{success: boolean; data: any}>(`/support/${id}`),
  create: (data: {subject: string; description: string; priority?: string}) =>
    request<{success: boolean; data: any}>('/support', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const billingAPI = {
  getPlans: () => request<{success: boolean; data: any}>('/billing/plans'),
  getSubscription: () =>
    request<{success: boolean; data: any}>('/billing/subscription'),
  getInvoices: () =>
    request<{success: boolean; data: any[]}>('/billing/invoices'),
};

export const settingsAPI = {
  get: () => request<{success: boolean; data: any}>('/settings'),
  update: (data: any) =>
    request<{success: boolean; data: any}>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

export const servicesAPI = {
  getAll: () =>
    request<{success: boolean; count: number; data: any[]}>('/services'),
  getById: (id: string) =>
    request<{success: boolean; data: any}>(`/services/${id}`),
  create: (data: any) =>
    request<{success: boolean; data: any}>('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    request<{success: boolean; data: any}>(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{success: boolean}>(`/services/${id}`, {method: 'DELETE'}),
};
