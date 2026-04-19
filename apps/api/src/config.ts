import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RepositoryMode } from "./types";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(srcDir, "..");
const repoRoot = path.resolve(apiRoot, "../..");

const asBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null || value.trim() === "") {
    return fallback;
  }
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
};

export type AppConfig = {
  port: number;
  apiRoot: string;
  repoRoot: string;
  generatedDataDir: string;
  runtimeDataDir: string;
  dataSource: RepositoryMode;
  awsRegion: string;
  churchesTableName: string;
  pastorsTableName: string;
  membersTableName: string;
  usersTableName: string;
  insightCacheBucket: string | null;
  openAiApiKey: string | null;
  openAiModel: string;
  cognitoUserPoolId: string | null;
  cognitoClientId: string | null;
  enableDemoAuth: boolean;
};

export const getConfig = (): AppConfig => ({
  port: Number(process.env.PORT ?? 4000),
  apiRoot,
  repoRoot,
  generatedDataDir: path.join(repoRoot, "data", "generated"),
  runtimeDataDir: path.join(repoRoot, "data", "runtime", "local-db"),
  dataSource: process.env.DATA_SOURCE === "dynamodb" ? "dynamodb" : "local",
  awsRegion: process.env.AWS_REGION ?? "ap-south-1",
  churchesTableName: process.env.CHURCHES_TABLE_NAME ?? "churches",
  pastorsTableName: process.env.PASTORS_TABLE_NAME ?? "pastors",
  membersTableName: process.env.MEMBERS_TABLE_NAME ?? "members",
  usersTableName: process.env.USERS_TABLE_NAME ?? "user_profiles",
  insightCacheBucket: process.env.INSIGHT_CACHE_BUCKET ?? null,
  openAiApiKey: process.env.OPENAI_API_KEY ?? null,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID ?? null,
  cognitoClientId: process.env.COGNITO_CLIENT_ID ?? null,
  enableDemoAuth: asBoolean(process.env.ENABLE_DEMO_AUTH, true),
});
