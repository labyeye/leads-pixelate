import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {authAPI, settingsAPI, setToken, removeToken} from '../services/api';
import storage from '../utils/storage';
import {
  setStatusOverrides,
  setCustomLeadStatuses,
} from '../constants/statusConstants';

function loadStatusSettings() {
  settingsAPI
    .get()
    .then(res => {
      setStatusOverrides(res.data?.leadStatusLabels);
      setCustomLeadStatuses(res.data?.customLeadStatuses);
    })
    .catch(() => {});
}

interface AuthContextType {
  user: any | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{requires2FA?: boolean; userId?: string}>;
  loginWithToken: (userData: any, token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({}),
  loginWithToken: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await storage.getItem('token');
        if (token) {
          const res = await authAPI.getMe();
          setUser(res.data);
          loadStatusSettings();
        }
      } catch {
        await removeToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authAPI.login(email, password);
    if ((res as any).data?.requires2FA) {
      return {
        requires2FA: true,
        userId: (res as any).data.userId,
      };
    }
    const token = res.token ?? (res.data as any)?.token;
    if (!token) {
      throw new Error('Login failed: no token received from server');
    }
    await setToken(token);
    await storage.setItem('user', JSON.stringify(res.data));
    setUser(res.data);
    loadStatusSettings();
    return {};
  };

  const loginWithToken = async (userData: any, token: string) => {
    await setToken(token);
    await storage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    loadStatusSettings();
  };

  const logout = async () => {
    await removeToken();
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await authAPI.getMe();
    setUser(res.data);
    await storage.setItem('user', JSON.stringify(res.data));
  };

  return (
    <AuthContext.Provider value={{user, isLoading, login, loginWithToken, logout, refreshUser}}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
