import crypto from "node:crypto";

import {
  churchDetailResponseSchema,
  churchSchema,
  dashboardFiltersSchema,
  dashboardOverviewSchema,
  insightSummaryRequestSchema,
  memberSchema,
  pastorSchema,
} from "@ngo/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

import { getConfig } from "./config";
import {
  applyDashboardFilters,
  buildChurchAnalytics,
  buildChurchListItems,
  buildDashboardOverview,
  filterChurchesForUser,
} from "./lib/analytics";
import { canAccessChurch, getCurrentUser } from "./lib/auth";
import { summarizeDashboard } from "./lib/insights";
import { createRepository } from "./lib/repository";

const repository = createRepository();

const churchInputSchema = churchSchema.pick({
  name: true,
  state: true,
  district: true,
  city: true,
  address: true,
  lat: true,
  lng: true,
  status: true,
}).extend({
  pastorId: z.string().nullable().optional(),
});

const pastorInputSchema = pastorSchema.pick({
  fullName: true,
  phone: true,
  joinedAt: true,
}).extend({
  baptized: z.boolean().optional(),
  notes: z.string().optional(),
});

const memberInputSchema = memberSchema.pick({
  fullName: true,
  phone: true,
  age: true,
  joinedAt: true,
  baptized: true,
  gender: true,
});

const jsonError = (message: string, status = 400) => Response.json({ message }, { status });

const parseJsonBody = async <T>(request: Request, schema: z.ZodType<T>): Promise<T> => {
  const json = await request.json();
  return schema.parse(json);
};

const loadScopedData = async (
  user: Awaited<ReturnType<typeof getCurrentUser>> extends infer T ? Exclude<T, null> : never,
  filters: z.infer<typeof dashboardFiltersSchema>,
) => {
  const allChurches = await repository.listChurches();
  const accessibleChurches = filterChurchesForUser(allChurches, user);
  const filteredChurches = applyDashboardFilters(accessibleChurches, filters);
  const churchIds = new Set(filteredChurches.map((church) => church.churchId));
  const allPastors = await repository.listPastors();
  const allMembers = await repository.listMembers();
  return {
    accessibleChurches,
    filteredChurches,
    pastors: allPastors.filter((pastor) => churchIds.has(pastor.churchId)),
    members: allMembers.filter((member) => churchIds.has(member.churchId)),
  };
};

export const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization", "x-demo-user-id"],
  allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
}));

app.get("/health", (c) => c.json({
  ok: true,
  mode: getConfig().dataSource,
  port: getConfig().port,
}));

app.get("/me", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }
  return c.json(user);
});

app.get("/dashboard/overview", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const filters = dashboardFiltersSchema.parse(c.req.query());
  const scoped = await loadScopedData(user, filters);
  const overview = dashboardOverviewSchema.parse(
    buildDashboardOverview(
      scoped.filteredChurches,
      scoped.pastors,
      scoped.members,
      scoped.accessibleChurches,
      filters,
    ),
  );
  return c.json(overview);
});

app.get("/churches", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const filters = dashboardFiltersSchema.parse(c.req.query());
  const scoped = await loadScopedData(user, filters);
  return c.json(buildChurchListItems(scoped.filteredChurches, scoped.pastors, scoped.members));
});

app.get("/churches/:churchId", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const churchId = c.req.param("churchId");
  if (!canAccessChurch(user, churchId)) {
    return c.json({ message: "Forbidden" }, 403);
  }

  const church = await repository.getChurchById(churchId);
  if (!church) {
    return c.json({ message: "Church not found" }, 404);
  }

  const pastors = await repository.listPastorsByChurch(churchId);
  const members = await repository.listMembersByChurch(churchId);

  return c.json(churchDetailResponseSchema.parse({
    church,
    pastors,
    members,
    analytics: buildChurchAnalytics(members),
  }));
});

app.post("/churches", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }
  if (user.role !== "super_admin") {
    return c.json({ message: "Only super admins can create churches" }, 403);
  }

  const input = await parseJsonBody(c.req.raw, churchInputSchema);
  const now = new Date().toISOString();
  const church = churchSchema.parse({
    ...input,
    churchId: `church-${crypto.randomUUID()}`,
    createdAt: now,
    updatedAt: now,
  });
  await repository.upsertChurch(church);
  return c.json(church, 201);
});

app.put("/churches/:churchId", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const churchId = c.req.param("churchId");
  if (!canAccessChurch(user, churchId)) {
    return c.json({ message: "Forbidden" }, 403);
  }

  const current = await repository.getChurchById(churchId);
  if (!current) {
    return c.json({ message: "Church not found" }, 404);
  }

  const input = await parseJsonBody(c.req.raw, churchInputSchema.partial());
  const nextChurch = churchSchema.parse({
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
  });
  await repository.upsertChurch(nextChurch);
  return c.json(nextChurch);
});

app.get("/churches/:churchId/pastors", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }
  const churchId = c.req.param("churchId");
  if (!canAccessChurch(user, churchId)) {
    return c.json({ message: "Forbidden" }, 403);
  }
  return c.json(await repository.listPastorsByChurch(churchId));
});

app.post("/churches/:churchId/pastors", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }
  const churchId = c.req.param("churchId");
  if (!canAccessChurch(user, churchId)) {
    return c.json({ message: "Forbidden" }, 403);
  }

  const church = await repository.getChurchById(churchId);
  if (!church) {
    return c.json({ message: "Church not found" }, 404);
  }

  const input = await parseJsonBody(c.req.raw, pastorInputSchema);
  const pastor = pastorSchema.parse({
    pastorId: `pastor-${crypto.randomUUID()}`,
    churchId,
    ...input,
  });
  await repository.upsertPastor(pastor);
  if (!church.pastorId) {
    await repository.upsertChurch({ ...church, pastorId: pastor.pastorId, updatedAt: new Date().toISOString() });
  }
  return c.json(pastor, 201);
});

app.put("/pastors/:pastorId", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const pastorId = c.req.param("pastorId");
  const current = await repository.getPastorById(pastorId);
  if (!current) {
    return c.json({ message: "Pastor not found" }, 404);
  }
  if (!canAccessChurch(user, current.churchId)) {
    return c.json({ message: "Forbidden" }, 403);
  }

  const input = await parseJsonBody(c.req.raw, pastorInputSchema.partial());
  const nextPastor = pastorSchema.parse({ ...current, ...input });
  await repository.upsertPastor(nextPastor);
  return c.json(nextPastor);
});

app.get("/churches/:churchId/members", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }
  const churchId = c.req.param("churchId");
  if (!canAccessChurch(user, churchId)) {
    return c.json({ message: "Forbidden" }, 403);
  }
  return c.json(await repository.listMembersByChurch(churchId));
});

app.post("/churches/:churchId/members", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }
  const churchId = c.req.param("churchId");
  if (!canAccessChurch(user, churchId)) {
    return c.json({ message: "Forbidden" }, 403);
  }

  const church = await repository.getChurchById(churchId);
  if (!church) {
    return c.json({ message: "Church not found" }, 404);
  }

  const input = await parseJsonBody(c.req.raw, memberInputSchema);
  const member = memberSchema.parse({
    memberId: `member-${crypto.randomUUID()}`,
    churchId,
    ...input,
  });
  await repository.upsertMember(member);
  return c.json(member, 201);
});

app.put("/members/:memberId", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const memberId = c.req.param("memberId");
  const current = await repository.getMemberById(memberId);
  if (!current) {
    return c.json({ message: "Member not found" }, 404);
  }
  if (!canAccessChurch(user, current.churchId)) {
    return c.json({ message: "Forbidden" }, 403);
  }

  const input = await parseJsonBody(c.req.raw, memberInputSchema.partial());
  const nextMember = memberSchema.parse({ ...current, ...input });
  await repository.upsertMember(nextMember);
  return c.json(nextMember);
});

app.post("/insights/summary", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const body = insightSummaryRequestSchema.parse(await c.req.json());
  const scoped = await loadScopedData(user, body.filters);
  const overview = buildDashboardOverview(
    scoped.filteredChurches,
    scoped.pastors,
    scoped.members,
    scoped.accessibleChurches,
    body.filters,
  );
  const summary = await summarizeDashboard(overview, body.filters, repository);
  return c.json(summary);
});

app.notFound(() => jsonError("Not found", 404));
app.onError((error, c) => {
  if (error instanceof Response) {
    return error;
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return c.json({ message }, 500);
});
