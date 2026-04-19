import type { Church, InsightSummary, Member, Pastor, UserProfile } from "@ngo/shared";

export type CachedInsightRecord = {
  cacheKey: string;
  createdAt: string;
  summary: InsightSummary;
};

export type LocalDatabase = {
  users: UserProfile[];
  churches: Church[];
  pastors: Pastor[];
  members: Member[];
  insightCache: CachedInsightRecord[];
  meta: {
    seedVersion: string;
    lastResetAt: string;
  };
};

export type AuthenticatedUser = UserProfile;

export type RepositoryMode = "local" | "dynamodb";
