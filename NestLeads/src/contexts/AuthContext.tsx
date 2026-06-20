import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {authAPI, setToken, removeToken} from '../services/api';
import storage from '../utils/storage';

interface AuthContextType {
  user: any | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
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
    const token = res.token ?? (res.data as any)?.token;
    if (!token) {
      throw new Error('Login failed: no token received from server');
    }
    await setToken(token);
    await storage.setItem('user', JSON.stringify(res.data));
    setUser(res.data);
  };

  const logout = async () => {
    await removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{user, isLoading, login, logout}}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
