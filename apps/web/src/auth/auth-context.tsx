import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { UserProfile } from "@ngo/shared";

import { api } from "@/lib/api";

import {
  clearStoredCognitoSession,
  completeCognitoLogin,
  getStoredCognitoSession,
  hasCognitoCallbackParams,
  isCognitoConfigured,
  readCognitoError,
  startCognitoLogin,
  startCognitoLogout,
} from "./cognito";
import { DEMO_ACCOUNTS } from "./demo-accounts";
import type { AuthSession, DemoSession } from "./types";

type AuthContextValue = {
  session: AuthSession | null;
  currentUser: UserProfile | null;
  isLoading: boolean;
  authError: string;
  isCognitoEnabled: boolean;
  isDemoEnabled: boolean;
  loginDemo: (email: string, password: string) => Promise<void>;
  loginWithCognito: (returnTo?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  demoAccounts: typeof DEMO_ACCOUNTS;
};

const STORAGE_KEY = "ngo-church-insights-demo-session";
const AuthContext = createContext<AuthContextValue | null>(null);

const asBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null || value.trim() === "") {
    return fallback;
  }
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
};

const isDemoEnabled = asBoolean(import.meta.env.VITE_ENABLE_DEMO_AUTH, true);
const isCognitoEnabled = isCognitoConfigured;

const readStoredSession = (): DemoSession | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<DemoSession> & { userId?: string; email?: string; mode?: string };
    if (!parsed.userId || !parsed.email) {
      return null;
    }

    return {
      mode: "demo",
      userId: parsed.userId,
      email: parsed.email,
    };
  } catch {
    return null;
  }
};

const writeStoredDemoSession = (session: DemoSession): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

const clearStoredDemoSession = (): void => {
  window.localStorage.removeItem(STORAGE_KEY);
};

const getCurrentPath = (): string => `${window.location.pathname}${window.location.search}${window.location.hash}`;

const cleanUpAuthUrl = (targetPath: string): void => {
  window.history.replaceState({}, document.title, targetPath);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>("");
  const [isSessionResolved, setIsSessionResolved] = useState<boolean>(false);

  const refreshUser = useCallback(async () => {
    if (!isSessionResolved) {
      return;
    }

    if (!session) {
      setCurrentUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const me = await api.getMe(session);
      setCurrentUser(me);
      setAuthError("");
    } catch (error) {
      setCurrentUser(null);
      setSession(null);
      setAuthError(error instanceof Error ? error.message : "Unable to restore your session.");

      if (session.mode === "cognito") {
        await clearStoredCognitoSession();
      } else {
        clearStoredDemoSession();
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSessionResolved, session]);

  useEffect(() => {
    let cancelled = false;

    const initializeSession = async () => {
      setIsLoading(true);

      try {
        const currentUrl = new URL(window.location.href);
        const callbackDetected = isCognitoEnabled && hasCognitoCallbackParams(currentUrl);
        const cognitoError = isCognitoEnabled ? readCognitoError(currentUrl) : null;
        let nextSession: AuthSession | null = null;
        let redirectTarget: string | null = null;

        if (callbackDetected) {
          const callbackResult = await completeCognitoLogin();
          nextSession = callbackResult.session;
          redirectTarget = callbackResult.returnTo ?? "/";
          cleanUpAuthUrl(redirectTarget);
        } else if (cognitoError) {
          if (!cancelled) {
            setAuthError(cognitoError);
          }
          cleanUpAuthUrl("/login");
        }

        if (!nextSession && isCognitoEnabled) {
          nextSession = await getStoredCognitoSession();
        }

        if (!nextSession && isDemoEnabled) {
          nextSession = readStoredSession();
        }

        if (!cancelled) {
          setSession(nextSession);
          setIsSessionResolved(true);
        }
      } catch (error) {
        if (!cancelled) {
          setSession(null);
          setIsSessionResolved(true);
          setAuthError(error instanceof Error ? error.message : "Unable to initialize authentication.");
          cleanUpAuthUrl("/login");
        }
      }
    };

    void initializeSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const loginDemo = useCallback(async (email: string, password: string) => {
    if (!isDemoEnabled) {
      throw new Error("Demo sign-in is disabled for this environment.");
    }

    const account = DEMO_ACCOUNTS.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (!account || account.password !== password) {
      throw new Error("Invalid demo credentials. Use one of the preloaded demo accounts.");
    }

    setAuthError("");
    await clearStoredCognitoSession();

    const nextSession: DemoSession = {
      mode: "demo",
      userId: account.userId,
      email: account.email,
    };

    setSession(nextSession);
    writeStoredDemoSession(nextSession);
  }, []);

  const loginWithCognito = useCallback(async (returnTo = getCurrentPath()) => {
    if (!isCognitoEnabled) {
      throw new Error("Cognito is not configured for this environment.");
    }

    setAuthError("");
    clearStoredDemoSession();
    await startCognitoLogin(returnTo);
  }, []);

  const logout = useCallback(() => {
    const activeSession = session;

    setSession(null);
    setCurrentUser(null);
    setAuthError("");
    clearStoredDemoSession();

    if (activeSession?.mode === "cognito") {
      void startCognitoLogout();
      return;
    }

    void clearStoredCognitoSession();
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    currentUser,
    isLoading,
    authError,
    isCognitoEnabled,
    isDemoEnabled,
    loginDemo,
    loginWithCognito,
    logout,
    refreshUser,
    demoAccounts: DEMO_ACCOUNTS,
  }), [session, currentUser, isLoading, authError, loginDemo, loginWithCognito, logout, refreshUser]);

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
