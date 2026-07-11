import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { User } from "@/types/crm";
import { authAPI, settingsAPI, hasSession } from "@/services/api";
import {
  setStatusOverrides,
  setCustomLeadStatuses,
} from "@/components/leads/statusConstants";

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
      // Clear any legacy user/tenant/token data left over from older versions
      // that stored the JWT in localStorage/sessionStorage.
      localStorage.removeItem("user");
      localStorage.removeItem("tenant");
      localStorage.removeItem("token");
      sessionStorage.removeItem("_aft");
      sessionStorage.removeItem("_cst");

      if (!hasSession()) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await authAPI.getMe();
        setUser(mapUser(response.data));
        setTenant(mapTenant(response.data.tenant));
        settingsAPI
          .get()
          .then((res) => {
            if (res.data?.permissions) setPermissions(res.data.permissions);
            setStatusOverrides(res.data?.leadStatusLabels);
            setCustomLeadStatuses(res.data?.customLeadStatuses);
          })
          .catch(() => {});
      } catch (error: any) {
        setUser(null);
        setTenant(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      const { tenant: tenantData, ...userData } = response.data;
      setUser(mapUser(userData));
      setTenant(mapTenant(tenantData));
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
        const { tenant: tenantData, ...userData } = response.data;
        setUser(mapUser(userData));
        setTenant(mapTenant(tenantData));
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
    authAPI.logout().catch(() => {});
    setUser(null);
    setTenant(null);
    setPermissions(null);
  }, []);

  const updateUser = useCallback((userData: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...userData } : null));
  }, []);

  const refreshTenant = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      setTenant(mapTenant(response.data.tenant));
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
