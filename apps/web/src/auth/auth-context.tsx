import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { UserProfile } from "@ngo/shared";

import { api } from "@/lib/api";

import { DEMO_ACCOUNTS } from "./demo-accounts";

type DemoSession = {
  userId: string;
  email: string;
};

type AuthContextValue = {
  session: DemoSession | null;
  currentUser: UserProfile | null;
  isLoading: boolean;
  loginDemo: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  demoAccounts: typeof DEMO_ACCOUNTS;
};

const STORAGE_KEY = "ngo-church-insights-demo-session";
const AuthContext = createContext<AuthContextValue | null>(null);

const readStoredSession = (): DemoSession | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoSession) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<DemoSession | null>(() => readStoredSession());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    if (!session?.userId) {
      setCurrentUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const me = await api.getMe(session.userId);
      setCurrentUser(me);
    } catch {
      setCurrentUser(null);
      setSession(null);
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [session?.userId]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const loginDemo = async (email: string, password: string) => {
    const account = DEMO_ACCOUNTS.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (!account || account.password !== password) {
      throw new Error("Invalid demo credentials. Use one of the preloaded demo accounts.");
    }

    const nextSession = { userId: account.userId, email: account.email };
    setSession(nextSession);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
  };

  const logout = () => {
    setSession(null);
    setCurrentUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo<AuthContextValue>(() => ({
    session,
    currentUser,
    isLoading,
    loginDemo,
    logout,
    refreshUser,
    demoAccounts: DEMO_ACCOUNTS,
  }), [session, currentUser, isLoading, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
