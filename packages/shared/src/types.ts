import type { z } from "zod";

import type {
  churchAnalyticsSchema,
  churchDetailResponseSchema,
  churchListItemSchema,
  churchSchema,
  dashboardFiltersSchema,
  dashboardOverviewSchema,
  insightSummaryRequestSchema,
  insightSummarySchema,
  memberSchema,
  pastorSchema,
  roleSchema,
  userProfileSchema,
} from "./schemas";

export type UserRole = z.infer<typeof roleSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type Church = z.infer<typeof churchSchema>;
export type Pastor = z.infer<typeof pastorSchema>;
export type Member = z.infer<typeof memberSchema>;
export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;
export type ChurchListItem = z.infer<typeof churchListItemSchema>;
export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
export type ChurchAnalytics = z.infer<typeof churchAnalyticsSchema>;
export type ChurchDetailResponse = z.infer<typeof churchDetailResponseSchema>;
export type InsightSummary = z.infer<typeof insightSummarySchema>;
export type InsightSummaryRequest = z.infer<typeof insightSummaryRequestSchema>;
