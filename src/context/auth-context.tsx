"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

import { api, setAccessToken as setApiAccessToken } from "@/lib/api-client";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const res = await api.post("/api/auth/refresh");
        setApiAccessToken(res.data.accessToken);

        const meRes = await api.get("/api/auth/me");
        setUser(meRes.data.user);
      } catch(error) {
        if (error instanceof Error) {
          console.error("Error restoring session:", error.message);
        }
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

    const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/api/auth/login", { email, password });
    setApiAccessToken(res.data.accessToken);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout");
    setApiAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}