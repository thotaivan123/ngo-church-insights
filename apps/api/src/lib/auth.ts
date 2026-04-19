import { CognitoJwtVerifier } from "aws-jwt-verify";
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
    cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId: config.cognitoUserPoolId,
      clientId: config.cognitoClientId,
      tokenUse: "id",
    });
  }
  return cognitoVerifier;
};

const getBearerToken = (value: string | undefined): string | null => (
  value?.startsWith("Bearer ") ? value.slice("Bearer ".length) : null
);

export const getCurrentUser = async (context: Context, repository: AppRepository): Promise<UserProfile | null> => {
  const token = getBearerToken(context.req.header("authorization"));
  if (token) {
    const verifier = getVerifier();
    if (!verifier) {
      return null;
    }
    const payload = await verifier.verify(token);
    const groups = Array.isArray(payload["cognito:groups"]) ? payload["cognito:groups"] : [];
    const role = groups.includes("super_admin") ? "super_admin" : "church_leader";
    const churchId = typeof payload["custom:churchId"] === "string" ? payload["custom:churchId"] : null;
    return (await repository.getUserById(payload.sub)) ?? {
      userId: payload.sub,
      role,
      churchId,
      displayName: typeof payload.name === "string" ? payload.name : payload.sub,
      email: typeof payload.email === "string" ? payload.email : `${payload.sub}@unknown.local`,
    };
  }

  if (!getConfig().enableDemoAuth) {
    return null;
  }

  const demoUserId = context.req.header("x-demo-user-id");
  return demoUserId ? repository.getUserById(demoUserId) : null;
};

export const canAccessChurch = (user: UserProfile, churchId: string): boolean => (
  user.role === "super_admin" || user.churchId === churchId
);
