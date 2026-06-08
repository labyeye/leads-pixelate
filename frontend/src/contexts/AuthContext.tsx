import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { User } from "@/types/crm";
import {
  authAPI,
  settingsAPI,
  setToken,
  removeToken,
  getToken,
} from "@/services/api";

interface Tenant {
  _id: string;
  name: string;
  plan:
    | "trial"
    | "starter"
    | "growth"
    | "professional"
    | "business"
    | "enterprise"
    | "pro";
  status: string;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  permissions: Record<string, Record<string, Record<string, boolean>>> | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    companyName: string;
    name: string;
    email: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  refreshTenant: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapUser(data: any): User {
  return {
    id: data._id || data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    avatar: data.avatar,
    phone: data.phone,
    department: data.department,
    employeeId: data.employeeId,
    status: data.status,
    lastLogin: data.lastLogin,
  };
}

function mapTenant(data: any): Tenant | null {
  if (!data) return null;
  return {
    _id: data._id,
    name: data.name,
    plan: data.plan,
    status: data.status,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [permissions, setPermissions] = useState<Record<
    string,
    Record<string, Record<string, boolean>>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const token = getToken();
      const storedUser = localStorage.getItem("user");
      const storedTenant = localStorage.getItem("tenant");

      if (token && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          if (storedTenant) setTenant(JSON.parse(storedTenant));
          setIsLoading(false);

          const response = await authAPI.getMe();
          const userData = mapUser(response.data);
          const tenantData = mapTenant(response.data.tenant);
          setUser(userData);
          setTenant(tenantData);
          localStorage.setItem("user", JSON.stringify(userData));
          localStorage.setItem("tenant", JSON.stringify(tenantData));

          settingsAPI
            .get()
            .then((res) => {
              if (res.data?.permissions) setPermissions(res.data.permissions);
            })
            .catch(() => {});
        } catch (error: any) {
          if (error.status === 401) {
            removeToken();
            localStorage.removeItem("user");
            localStorage.removeItem("tenant");
            setUser(null);
            setTenant(null);
          }
        }
      }
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      const { token, tenant: tenantData, ...userData } = response.data;
      setToken(token);
      const mappedUser = mapUser(userData);
      const mappedTenant = mapTenant(tenantData);
      setUser(mappedUser);
      setTenant(mappedTenant);
      localStorage.setItem("user", JSON.stringify(mappedUser));
      localStorage.setItem("tenant", JSON.stringify(mappedTenant));
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Login failed. Please try again.",
      };
    }
  }, []);

  const register = useCallback(
    async (data: {
      companyName: string;
      name: string;
      email: string;
      password: string;
    }) => {
      try {
        const response = await authAPI.register({
          name: data.name,
          email: data.email,
          password: data.password,
          companyName: data.companyName,
        } as any);
        const { token, tenant: tenantData, ...userData } = response.data;
        setToken(token);
        const mappedUser = mapUser(userData);
        const mappedTenant = mapTenant(tenantData);
        setUser(mappedUser);
        setTenant(mappedTenant);
        localStorage.setItem("user", JSON.stringify(mappedUser));
        localStorage.setItem("tenant", JSON.stringify(mappedTenant));
        return { success: true };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || "Registration failed. Please try again.",
        };
      }
    },
    [],
  );

  const logout = useCallback(() => {
    removeToken();
    localStorage.removeItem("user");
    localStorage.removeItem("tenant");
    setUser(null);
    setTenant(null);
    setPermissions(null);
  }, []);

  const updateUser = useCallback((userData: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...userData };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const refreshTenant = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      const tenantData = mapTenant(response.data.tenant);
      setTenant(tenantData);
      localStorage.setItem("tenant", JSON.stringify(tenantData));
    } catch {}
  }, []);

  const refreshPermissions = useCallback(async () => {
    try {
      const res = await settingsAPI.get();
      setPermissions(res.data?.permissions || null);
    } catch {}
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        permissions,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        refreshPermissions,
        refreshTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}
