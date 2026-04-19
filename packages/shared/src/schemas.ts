import { z } from "zod";

export const roleSchema = z.enum(["super_admin", "church_leader"]);

export const userProfileSchema = z.object({
  userId: z.string().min(1),
  role: roleSchema,
  churchId: z.string().nullable().optional(),
  displayName: z.string().min(1),
  email: z.email(),
});

export const churchSchema = z.object({
  churchId: z.string().min(1),
  name: z.string().min(1),
  state: z.string().min(1),
  district: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  pastorId: z.string().nullable().optional(),
  status: z.enum(["active", "growing", "new", "support_needed"]).default("active"),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const pastorSchema = z.object({
  pastorId: z.string().min(1),
  churchId: z.string().min(1),
  fullName: z.string().min(1),
  phone: z.string().min(1),
  joinedAt: z.string().min(1),
  baptized: z.boolean().optional(),
  notes: z.string().optional(),
});

export const memberSchema = z.object({
  memberId: z.string().min(1),
  churchId: z.string().min(1),
  fullName: z.string().min(1),
  phone: z.string().min(1),
  age: z.number().int().min(0).max(120),
  joinedAt: z.string().min(1),
  baptized: z.boolean(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

export const dashboardFiltersSchema = z.object({
  state: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  churchId: z.string().optional(),
});

export const chartDatumSchema = z.object({
  label: z.string(),
  value: z.number(),
});

export const mapMarkerSchema = z.object({
  churchId: z.string(),
  name: z.string(),
  state: z.string(),
  district: z.string(),
  city: z.string(),
  lat: z.number(),
  lng: z.number(),
  pastorName: z.string().nullable().optional(),
  memberCount: z.number().int().nonnegative(),
  baptizedPercentage: z.number().min(0).max(100),
  status: z.string(),
});

export const churchListItemSchema = z.object({
  churchId: z.string(),
  name: z.string(),
  state: z.string(),
  district: z.string(),
  city: z.string(),
  pastorName: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
  baptizedPercentage: z.number().min(0).max(100),
  status: z.string(),
});

export const dashboardOverviewSchema = z.object({
  filters: z.object({
    states: z.array(z.string()),
    districts: z.array(z.string()),
    cities: z.array(z.string()),
    churches: z.array(z.object({ churchId: z.string(), name: z.string() })),
  }),
  kpis: z.object({
    totalChurches: z.number().int().nonnegative(),
    totalPastors: z.number().int().nonnegative(),
    totalMembers: z.number().int().nonnegative(),
    baptizedPercentage: z.number().min(0).max(100),
    citiesCovered: z.number().int().nonnegative(),
    districtsCovered: z.number().int().nonnegative(),
  }),
  map: z.object({
    center: z.tuple([z.number(), z.number()]),
    zoom: z.number(),
    markers: z.array(mapMarkerSchema),
  }),
  charts: z.object({
    topDistricts: z.array(chartDatumSchema),
    baptismBreakdown: z.array(chartDatumSchema),
    ageDistribution: z.array(chartDatumSchema),
    joinYearTrend: z.array(chartDatumSchema),
  }),
  churches: z.array(churchListItemSchema),
});

export const churchAnalyticsSchema = z.object({
  baptismBreakdown: z.array(chartDatumSchema),
  ageDistribution: z.array(chartDatumSchema),
  joinYearTrend: z.array(chartDatumSchema),
});

export const churchDetailResponseSchema = z.object({
  church: churchSchema,
  pastors: z.array(pastorSchema),
  members: z.array(memberSchema),
  analytics: churchAnalyticsSchema,
});

export const insightSummarySchema = z.object({
  headline: z.string(),
  highlights: z.array(z.string()),
  risks: z.array(z.string()),
  recommendedAction: z.string(),
});

export const insightSummaryRequestSchema = z.object({
  filters: dashboardFiltersSchema.default({}),
});
