import crypto from "node:crypto";

import {
  dashboardFiltersSchema,
  insightSummarySchema,
  type DashboardOverview,
} from "@ngo/shared";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { getConfig } from "../config";
import type { CachedInsightRecord } from "../types";
import type { AppRepository } from "./repository";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const buildCacheKey = (filters: unknown): string => (
  crypto.createHash("sha256").update(JSON.stringify(filters ?? {})).digest("hex")
);

const isFresh = (record: CachedInsightRecord | null): boolean => {
  if (!record) {
    return false;
  }
  const ageMs = Date.now() - new Date(record.createdAt).getTime();
  return ageMs >= 0 && ageMs <= CACHE_TTL_MS;
};

const buildFallbackSummary = (overview: DashboardOverview) => {
  const topDistrict = overview.charts.topDistricts[0];
  const topAgeBand = overview.charts.ageDistribution[0];
  const baptized = overview.charts.baptismBreakdown.find((item) => item.label === "Baptized")?.value ?? 0;
  const notBaptized = overview.charts.baptismBreakdown.find((item) => item.label === "Not Baptized")?.value ?? 0;

  return {
    headline: `${overview.kpis.totalChurches} churches and ${overview.kpis.totalMembers} members are currently in scope for this view.`,
    highlights: [
      topDistrict
        ? `${topDistrict.label} has the highest visible congregation count in the current filter scope.`
        : "District-level concentration becomes clearer once more churches are included in the current view.",
      topAgeBand
        ? `The strongest visible age band is ${topAgeBand.label}.`
        : "Age distribution becomes available once member records are loaded for the current filter scope.",
      `${baptized} visible members are marked baptized across the selected churches.`,
    ],
    risks: [
      notBaptized > baptized
        ? "The current scope shows more not-baptized than baptized members, which may indicate discipleship follow-up needs."
        : "Baptism coverage looks comparatively healthy, but city-level follow-up should still be reviewed.",
      overview.kpis.totalChurches < 5
        ? "This summary is based on a narrow filter window, so broad strategic conclusions should be treated carefully."
        : "Growth and engagement patterns can vary sharply by city and district, so local leadership review still matters.",
    ],
    recommendedAction: topDistrict
      ? `Review the churches in ${topDistrict.label} first and compare their baptism and age trends to the wider network.`
      : "Review the visible churches and prioritize follow-up in locations with weaker growth or baptism coverage.",
  };
};

export const summarizeDashboard = async (
  overview: DashboardOverview,
  rawFilters: unknown,
  repository: AppRepository,
) => {
  const filters = dashboardFiltersSchema.parse(rawFilters ?? {});
  const cacheKey = buildCacheKey(filters);
  const cached = await repository.getCachedInsight(cacheKey);
  if (cached && isFresh(cached)) {
    return cached.summary;
  }

  const config = getConfig();
  const fallback = buildFallbackSummary(overview);

  if (!config.openAiApiKey) {
    await repository.putCachedInsight({ cacheKey, createdAt: new Date().toISOString(), summary: fallback });
    return fallback;
  }

  const client = new OpenAI({ apiKey: config.openAiApiKey });
  const aggregatedPayload = {
    filters,
    kpis: overview.kpis,
    charts: overview.charts,
    churches: overview.churches.slice(0, 20).map((church) => ({
      name: church.name,
      state: church.state,
      district: church.district,
      city: church.city,
      memberCount: church.memberCount,
      baptizedPercentage: church.baptizedPercentage,
      status: church.status,
    })),
  };

  try {
    const response = await client.responses.parse({
      model: config.openAiModel,
      store: false,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are an NGO analytics assistant. Use only the aggregated dashboard metrics provided. Never invent names, phone numbers, personal stories, or precise facts that are not in the payload.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Create a concise executive summary from this aggregated data only:\n${JSON.stringify(aggregatedPayload, null, 2)}`,
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(insightSummarySchema, "insight_summary"),
      },
    });

    const summary = insightSummarySchema.parse(response.output_parsed ?? fallback);
    await repository.putCachedInsight({ cacheKey, createdAt: new Date().toISOString(), summary });
    return summary;
  } catch {
    await repository.putCachedInsight({ cacheKey, createdAt: new Date().toISOString(), summary: fallback });
    return fallback;
  }
};
