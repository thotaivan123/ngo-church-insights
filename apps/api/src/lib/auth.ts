import { CognitoJwtVerifier } from "aws-jwt-verify";
import { SimpleFetcher } from "aws-jwt-verify/https";
import { SimpleJwksCache } from "aws-jwt-verify/jwk";
import type { Context } from "hono";

import type { UserProfile } from "@ngo/shared";

import { getConfig } from "../config";
import type { AppRepository } from "./repository";

let cognitoVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

const getVerifier = () => {
  const config = getConfig();
  if (!config.cognitoUserPoolId || !config.cognitoClientId) {
    return null;
  }
  if (!cognitoVerifier) {
    const jwksCache = new SimpleJwksCache({
      fetcher: new SimpleFetcher({
        defaultRequestOptions: {
          timeout: config.cognitoJwksSocketTimeoutMs,
          responseTimeout: config.cognitoJwksResponseTimeoutMs,
        },
      }),
    });

    cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId: config.cognitoUserPoolId,
      clientId: config.cognitoClientId,
      tokenUse: "id",
    }, { jwksCache });
  }
  return cognitoVerifier;
};

const getBearerToken = (value: string | undefined): string | null => (
  value?.startsWith("Bearer ") ? value.slice("Bearer ".length) : null
);

const asString = (value: unknown): string | null => (
  typeof value === "string" && value.trim() ? value : null
);

const unique = <T,>(values: T[]): T[] => [...new Set(values)];

const toCandidateEmails = (payload: Record<string, unknown>): string[] => unique(
  [
    asString(payload.email),
    asString(payload["cognito:username"]),
    asString(payload.preferred_username),
    asString(payload.username),
  ]
    .filter((value): value is string => Boolean(value?.includes("@")))
    .map((value) => value.trim().toLowerCase()),
);

const getRoleFromGroups = (value: unknown): UserProfile["role"] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const groups = value.filter((item): item is string => typeof item === "string");
  if (groups.includes("super_admin")) {
    return "super_admin";
  }
  if (groups.includes("church_leader")) {
    return "church_leader";
  }
  return null;
};

const resolveCurrentUser = async (
  context: Context,
  repository: AppRepository,
): Promise<{ user: UserProfile | null; errorMessage: string | null }> => {
  const token = getBearerToken(context.req.header("authorization"));
  if (token) {
    const verifier = getVerifier();
    if (!verifier) {
      return {
        user: null,
        errorMessage: "Cognito verifier is not configured on the API. Check COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID.",
      };
    }

    try {
      const payload = await verifier.verify(token);
      const email = asString(payload.email);
      const candidateEmails = toCandidateEmails(payload);
      const existingUserById = await repository.getUserById(payload.sub);
      let existingUser = existingUserById;

      if (!existingUser) {
        for (const candidateEmail of candidateEmails) {
          existingUser = await repository.getUserByEmail(candidateEmail);
          if (existingUser) {
            break;
          }
        }
      }

      const role = getRoleFromGroups(payload["cognito:groups"]) ?? existingUser?.role ?? "church_leader";
      const churchId = role === "super_admin"
        ? null
        : asString(payload["custom:churchId"]) ?? existingUser?.churchId ?? null;
      const resolvedEmail = email ?? existingUser?.email ?? candidateEmails[0] ?? `${payload.sub}@unknown.local`;

      return {
        user: {
          userId: payload.sub,
          role,
          churchId,
          displayName: existingUser?.displayName ?? asString(payload.name) ?? resolvedEmail ?? payload.sub,
          email: resolvedEmail,
        },
        errorMessage: null,
      };
    } catch (error) {
      return {
        user: null,
        errorMessage: error instanceof Error ? error.message : "Cognito token verification failed.",
      };
    }
  }

  if (!getConfig().enableDemoAuth) {
    return {
      user: null,
      errorMessage: "No bearer token was provided and demo auth is disabled.",
    };
  }

  const demoUserId = context.req.header("x-demo-user-id");
  if (!demoUserId) {
    return {
      user: null,
      errorMessage: "No demo user header was provided.",
    };
  }

  const demoUser = await repository.getUserById(demoUserId);
  return {
    user: demoUser,
    errorMessage: demoUser ? null : `Demo user '${demoUserId}' was not found in the local user store.`,
  };
};

export const getCurrentUser = async (context: Context, repository: AppRepository): Promise<UserProfile | null> => (
  (await resolveCurrentUser(context, repository)).user
);

export const getAuthorizationFailureReason = async (context: Context, repository: AppRepository): Promise<string | null> => (
  (await resolveCurrentUser(context, repository)).errorMessage
);

export const canAccessChurch = (user: UserProfile, churchId: string): boolean => (
  user.role === "super_admin" || user.churchId === churchId
);

export const hydrateCognitoVerifier = async (): Promise<void> => {
  const verifier = getVerifier();
  if (!verifier) {
    return;
  }

  await verifier.hydrate();
};
