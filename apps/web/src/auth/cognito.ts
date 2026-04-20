import { UserManager, WebStorageStateStore, type User, type UserManagerSettings } from "oidc-client-ts";

import type { CognitoSession } from "./types";

const asString = (value: unknown): string | null => (
  typeof value === "string" && value.trim() ? value : null
);

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const region = asString(import.meta.env.VITE_COGNITO_REGION);
const userPoolId = asString(import.meta.env.VITE_COGNITO_USER_POOL_ID);
const clientId = asString(import.meta.env.VITE_COGNITO_CLIENT_ID);
const cognitoDomain = asString(import.meta.env.VITE_COGNITO_DOMAIN);
const redirectSignIn = asString(import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN) ?? "http://localhost:5173/";
const redirectSignOut = asString(import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT) ?? "http://localhost:5173/login";

const normalizedDomain = cognitoDomain ? trimTrailingSlash(cognitoDomain) : null;
const issuer = region && userPoolId
  ? `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`
  : null;

let userManager: UserManager | null = null;

export const isCognitoConfigured = Boolean(region && userPoolId && clientId && normalizedDomain && issuer);

const getUserManager = (): UserManager | null => {
  if (!isCognitoConfigured || !issuer || !clientId || !normalizedDomain || typeof window === "undefined") {
    return null;
  }

  if (!userManager) {
    const settings: UserManagerSettings = {
      authority: issuer,
      client_id: clientId,
      redirect_uri: redirectSignIn,
      post_logout_redirect_uri: redirectSignOut,
      response_type: "code",
      scope: "openid email",
      loadUserInfo: false,
      automaticSilentRenew: false,
      monitorSession: false,
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      metadata: {
        issuer,
        authorization_endpoint: `${normalizedDomain}/oauth2/authorize`,
        token_endpoint: `${normalizedDomain}/oauth2/token`,
        userinfo_endpoint: `${normalizedDomain}/oauth2/userInfo`,
        revocation_endpoint: `${normalizedDomain}/oauth2/revoke`,
        end_session_endpoint: `${normalizedDomain}/logout`,
        jwks_uri: `${issuer}/.well-known/jwks.json`,
      },
    };
    userManager = new UserManager(settings);
  }

  return userManager;
};

const buildSessionFromUser = (user: User | null): CognitoSession | null => {
  if (!user || user.expired || !user.id_token) {
    return null;
  }

  const userId = asString(user.profile.sub);
  const email = asString(user.profile.email);
  if (!userId || !email) {
    return null;
  }

  return {
    mode: "cognito",
    userId,
    email,
    idToken: user.id_token,
  };
};

export const hasCognitoCallbackParams = (url: URL = new URL(window.location.href)): boolean => (
  Boolean(url.searchParams.get("code") && url.searchParams.get("state"))
);

export const readCognitoError = (url: URL = new URL(window.location.href)): string | null => (
  url.searchParams.get("error_description") ?? url.searchParams.get("error")
);

export const getStoredCognitoSession = async (): Promise<CognitoSession | null> => {
  const manager = getUserManager();
  if (!manager) {
    return null;
  }
  return buildSessionFromUser(await manager.getUser());
};

export const startCognitoLogin = async (returnTo: string): Promise<void> => {
  const manager = getUserManager();
  if (!manager) {
    throw new Error("Cognito is not configured for this frontend.");
  }

  await manager.signinRedirect({
    state: { returnTo },
  });
};

export const completeCognitoLogin = async (): Promise<{ session: CognitoSession | null; returnTo: string | null }> => {
  const manager = getUserManager();
  if (!manager) {
    return { session: null, returnTo: null };
  }

  const user = (await manager.signinCallback(window.location.href)) ?? null;
  const state = user?.state;
  const returnTo = typeof state === "object"
    && state
    && "returnTo" in state
    && typeof state.returnTo === "string"
    ? state.returnTo
    : null;

  return {
    session: buildSessionFromUser(user),
    returnTo,
  };
};

export const clearStoredCognitoSession = async (): Promise<void> => {
  const manager = getUserManager();
  if (!manager) {
    return;
  }
  await manager.removeUser();
};

export const startCognitoLogout = async (): Promise<void> => {
  await clearStoredCognitoSession();

  if (!normalizedDomain || !clientId || typeof window === "undefined") {
    window.location.assign(redirectSignOut);
    return;
  }

  const logoutUrl = new URL(`${normalizedDomain}/logout`);
  logoutUrl.searchParams.set("client_id", clientId);
  logoutUrl.searchParams.set("logout_uri", redirectSignOut);
  window.location.assign(logoutUrl.toString());
};
