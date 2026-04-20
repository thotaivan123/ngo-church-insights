// src/lambda.ts
import { handle } from "hono/aws-lambda";

// src/app.ts
import crypto2 from "crypto";
import {
  churchDetailResponseSchema,
  churchSchema,
  dashboardFiltersSchema as dashboardFiltersSchema2,
  dashboardOverviewSchema,
  insightSummaryRequestSchema,
  memberSchema,
  pastorSchema
} from "@ngo/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

// src/config.ts
import path from "path";
import { fileURLToPath } from "url";
var srcDir = path.dirname(fileURLToPath(import.meta.url));
var apiRoot = path.resolve(srcDir, "..");
var repoRoot = path.resolve(apiRoot, "../..");
var asBoolean = (value, fallback) => {
  if (value == null || value.trim() === "") {
    return fallback;
  }
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
};
var getConfig = () => ({
  port: Number(process.env.PORT ?? 4e3),
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
  enableDemoAuth: asBoolean(process.env.ENABLE_DEMO_AUTH, true)
});

// src/lib/analytics.ts
var INDIA_CENTER = [22.9734, 78.6569];
var toPercent = (value, total) => {
  if (total <= 0) {
    return 0;
  }
  return Number((value / total * 100).toFixed(1));
};
var ageBandFor = (age) => {
  if (age <= 12) return "0-12";
  if (age <= 17) return "13-17";
  if (age <= 25) return "18-25";
  if (age <= 40) return "26-40";
  if (age <= 60) return "41-60";
  return "60+";
};
var toJoinYear = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }
  return String(parsed.getFullYear());
};
var aggregate = (values) => {
  const counts = /* @__PURE__ */ new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value);
};
var sortLabels = (values) => [...new Set(values)].sort((left, right) => left.localeCompare(right));
var filterChurchesForUser = (churches, user) => {
  if (user.role === "super_admin") {
    return churches;
  }
  if (!user.churchId) {
    return [];
  }
  return churches.filter((church) => church.churchId === user.churchId);
};
var applyDashboardFilters = (churches, filters) => churches.filter((church) => {
  if (filters.state && church.state !== filters.state) return false;
  if (filters.district && church.district !== filters.district) return false;
  if (filters.city && church.city !== filters.city) return false;
  if (filters.churchId && church.churchId !== filters.churchId) return false;
  return true;
});
var buildFilterOptions = (churches, filters) => {
  const stateScoped = filters.state ? churches.filter((church) => church.state === filters.state) : churches;
  const districtScoped = filters.district ? stateScoped.filter((church) => church.district === filters.district) : stateScoped;
  const cityScoped = filters.city ? districtScoped.filter((church) => church.city === filters.city) : districtScoped;
  return {
    states: sortLabels(churches.map((church) => church.state)),
    districts: sortLabels(stateScoped.map((church) => church.district)),
    cities: sortLabels(districtScoped.map((church) => church.city)),
    churches: cityScoped.map((church) => ({ churchId: church.churchId, name: church.name })).sort((left, right) => left.name.localeCompare(right.name))
  };
};
var buildChurchListItems = (churches, pastors, members) => {
  const pastorNameByChurch = /* @__PURE__ */ new Map();
  pastors.forEach((pastor) => {
    if (!pastorNameByChurch.has(pastor.churchId)) {
      pastorNameByChurch.set(pastor.churchId, pastor.fullName);
    }
  });
  const membersByChurch = /* @__PURE__ */ new Map();
  members.forEach((member) => {
    const bucket = membersByChurch.get(member.churchId) ?? [];
    bucket.push(member);
    membersByChurch.set(member.churchId, bucket);
  });
  return churches.map((church) => {
    const churchMembers = membersByChurch.get(church.churchId) ?? [];
    const baptized = churchMembers.filter((member) => member.baptized).length;
    return {
      churchId: church.churchId,
      name: church.name,
      state: church.state,
      district: church.district,
      city: church.city,
      pastorName: pastorNameByChurch.get(church.churchId) ?? null,
      memberCount: churchMembers.length,
      baptizedPercentage: toPercent(baptized, churchMembers.length),
      status: church.status
    };
  }).sort((left, right) => right.memberCount - left.memberCount || left.name.localeCompare(right.name));
};
var buildChurchAnalytics = (members) => ({
  baptismBreakdown: [
    { label: "Baptized", value: members.filter((member) => member.baptized).length },
    { label: "Not Baptized", value: members.filter((member) => !member.baptized).length }
  ],
  ageDistribution: aggregate(members.map((member) => ageBandFor(member.age))),
  joinYearTrend: aggregate(members.map((member) => toJoinYear(member.joinedAt))).sort((left, right) => left.label.localeCompare(right.label))
});
var buildDashboardOverview = (filteredChurches, filteredPastors, filteredMembers, accessibleChurches, filters) => {
  const churchListItems = buildChurchListItems(filteredChurches, filteredPastors, filteredMembers);
  const membersByChurch = /* @__PURE__ */ new Map();
  filteredMembers.forEach((member) => {
    const bucket = membersByChurch.get(member.churchId) ?? [];
    bucket.push(member);
    membersByChurch.set(member.churchId, bucket);
  });
  const districtCounts = /* @__PURE__ */ new Map();
  filteredChurches.forEach((church) => {
    districtCounts.set(
      church.district,
      (districtCounts.get(church.district) ?? 0) + (membersByChurch.get(church.churchId)?.length ?? 0)
    );
  });
  const baptizedCount = filteredMembers.filter((member) => member.baptized).length;
  return {
    filters: buildFilterOptions(accessibleChurches, filters),
    kpis: {
      totalChurches: filteredChurches.length,
      totalPastors: filteredPastors.length,
      totalMembers: filteredMembers.length,
      baptizedPercentage: toPercent(baptizedCount, filteredMembers.length),
      citiesCovered: new Set(filteredChurches.map((church) => church.city)).size,
      districtsCovered: new Set(filteredChurches.map((church) => church.district)).size
    },
    map: {
      center: INDIA_CENTER,
      zoom: 5,
      markers: filteredChurches.map((church) => {
        const churchSummary = churchListItems.find((item) => item.churchId === church.churchId);
        return {
          churchId: church.churchId,
          name: church.name,
          state: church.state,
          district: church.district,
          city: church.city,
          lat: church.lat,
          lng: church.lng,
          pastorName: churchSummary?.pastorName ?? null,
          memberCount: churchSummary?.memberCount ?? 0,
          baptizedPercentage: churchSummary?.baptizedPercentage ?? 0,
          status: church.status
        };
      })
    },
    charts: {
      topDistricts: [...districtCounts.entries()].map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value).slice(0, 8),
      baptismBreakdown: [
        { label: "Baptized", value: baptizedCount },
        { label: "Not Baptized", value: filteredMembers.length - baptizedCount }
      ],
      ageDistribution: aggregate(filteredMembers.map((member) => ageBandFor(member.age))),
      joinYearTrend: aggregate(filteredMembers.map((member) => toJoinYear(member.joinedAt))).sort((left, right) => left.label.localeCompare(right.label))
    },
    churches: churchListItems
  };
};

// src/lib/auth.ts
import { CognitoJwtVerifier } from "aws-jwt-verify";
var cognitoVerifier = null;
var getVerifier = () => {
  const config = getConfig();
  if (!config.cognitoUserPoolId || !config.cognitoClientId) {
    return null;
  }
  if (!cognitoVerifier) {
    cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId: config.cognitoUserPoolId,
      clientId: config.cognitoClientId,
      tokenUse: "id"
    });
  }
  return cognitoVerifier;
};
var getBearerToken = (value) => value?.startsWith("Bearer ") ? value.slice("Bearer ".length) : null;
var asString = (value) => typeof value === "string" && value.trim() ? value : null;
var getRoleFromGroups = (value) => {
  if (!Array.isArray(value)) {
    return null;
  }
  const groups = value.filter((item) => typeof item === "string");
  if (groups.includes("super_admin")) {
    return "super_admin";
  }
  if (groups.includes("church_leader")) {
    return "church_leader";
  }
  return null;
};
var getCurrentUser = async (context, repository2) => {
  const token = getBearerToken(context.req.header("authorization"));
  if (token) {
    const verifier = getVerifier();
    if (!verifier) {
      return null;
    }
    try {
      const payload = await verifier.verify(token);
      const email = asString(payload.email);
      const existingUser = await repository2.getUserById(payload.sub) ?? (email ? await repository2.getUserByEmail(email) : null);
      const role = getRoleFromGroups(payload["cognito:groups"]) ?? existingUser?.role ?? "church_leader";
      const churchId = role === "super_admin" ? null : asString(payload["custom:churchId"]) ?? existingUser?.churchId ?? null;
      return {
        userId: payload.sub,
        role,
        churchId,
        displayName: existingUser?.displayName ?? asString(payload.name) ?? email ?? payload.sub,
        email: email ?? existingUser?.email ?? `${payload.sub}@unknown.local`
      };
    } catch {
      return null;
    }
  }
  if (!getConfig().enableDemoAuth) {
    return null;
  }
  const demoUserId = context.req.header("x-demo-user-id");
  return demoUserId ? repository2.getUserById(demoUserId) : null;
};
var canAccessChurch = (user, churchId) => user.role === "super_admin" || user.churchId === churchId;

// src/lib/insights.ts
import crypto from "crypto";
import {
  dashboardFiltersSchema,
  insightSummarySchema
} from "@ngo/shared";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
var CACHE_TTL_MS = 24 * 60 * 60 * 1e3;
var buildCacheKey = (filters) => crypto.createHash("sha256").update(JSON.stringify(filters ?? {})).digest("hex");
var isFresh = (record) => {
  if (!record) {
    return false;
  }
  const ageMs = Date.now() - new Date(record.createdAt).getTime();
  return ageMs >= 0 && ageMs <= CACHE_TTL_MS;
};
var buildFallbackSummary = (overview) => {
  const topDistrict = overview.charts.topDistricts[0];
  const topAgeBand = overview.charts.ageDistribution[0];
  const baptized = overview.charts.baptismBreakdown.find((item) => item.label === "Baptized")?.value ?? 0;
  const notBaptized = overview.charts.baptismBreakdown.find((item) => item.label === "Not Baptized")?.value ?? 0;
  return {
    headline: `${overview.kpis.totalChurches} churches and ${overview.kpis.totalMembers} members are currently in scope for this view.`,
    highlights: [
      topDistrict ? `${topDistrict.label} has the highest visible congregation count in the current filter scope.` : "District-level concentration becomes clearer once more churches are included in the current view.",
      topAgeBand ? `The strongest visible age band is ${topAgeBand.label}.` : "Age distribution becomes available once member records are loaded for the current filter scope.",
      `${baptized} visible members are marked baptized across the selected churches.`
    ],
    risks: [
      notBaptized > baptized ? "The current scope shows more not-baptized than baptized members, which may indicate discipleship follow-up needs." : "Baptism coverage looks comparatively healthy, but city-level follow-up should still be reviewed.",
      overview.kpis.totalChurches < 5 ? "This summary is based on a narrow filter window, so broad strategic conclusions should be treated carefully." : "Growth and engagement patterns can vary sharply by city and district, so local leadership review still matters."
    ],
    recommendedAction: topDistrict ? `Review the churches in ${topDistrict.label} first and compare their baptism and age trends to the wider network.` : "Review the visible churches and prioritize follow-up in locations with weaker growth or baptism coverage."
  };
};
var summarizeDashboard = async (overview, rawFilters, repository2) => {
  const filters = dashboardFiltersSchema.parse(rawFilters ?? {});
  const cacheKey = buildCacheKey(filters);
  const cached = await repository2.getCachedInsight(cacheKey);
  if (cached && isFresh(cached)) {
    return cached.summary;
  }
  const config = getConfig();
  const fallback = buildFallbackSummary(overview);
  if (!config.openAiApiKey) {
    await repository2.putCachedInsight({ cacheKey, createdAt: (/* @__PURE__ */ new Date()).toISOString(), summary: fallback });
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
      status: church.status
    }))
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
              text: "You are an NGO analytics assistant. Use only the aggregated dashboard metrics provided. Never invent names, phone numbers, personal stories, or precise facts that are not in the payload."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Create a concise executive summary from this aggregated data only:
${JSON.stringify(aggregatedPayload, null, 2)}`
            }
          ]
        }
      ],
      text: {
        format: zodTextFormat(insightSummarySchema, "insight_summary")
      }
    });
    const summary = insightSummarySchema.parse(response.output_parsed ?? fallback);
    await repository2.putCachedInsight({ cacheKey, createdAt: (/* @__PURE__ */ new Date()).toISOString(), summary });
    return summary;
  } catch {
    await repository2.putCachedInsight({ cacheKey, createdAt: (/* @__PURE__ */ new Date()).toISOString(), summary: fallback });
    return fallback;
  }
};

// src/lib/repository.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";

// src/lib/local-db.ts
import fs from "fs/promises";
import path2 from "path";
var ENTITY_FILES = {
  users: "users.json",
  churches: "churches.json",
  pastors: "pastors.json",
  members: "members.json",
  insightCache: "insight-cache.json",
  meta: "meta.json"
};
var readJson = async (filePath, fallback) => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};
var writeJson = async (filePath, value) => {
  await fs.mkdir(path2.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}
`, "utf-8");
};
var copyIfMissing = async (sourcePath, targetPath, fallback) => {
  try {
    await fs.access(targetPath);
  } catch {
    await fs.mkdir(path2.dirname(targetPath), { recursive: true });
    try {
      const contents = await fs.readFile(sourcePath, "utf-8");
      await fs.writeFile(targetPath, contents, "utf-8");
    } catch {
      await writeJson(targetPath, fallback);
    }
  }
};
var ensureLocalDbInitialized = async () => {
  const config = getConfig();
  await fs.mkdir(config.runtimeDataDir, { recursive: true });
  await copyIfMissing(
    path2.join(config.generatedDataDir, ENTITY_FILES.users),
    path2.join(config.runtimeDataDir, ENTITY_FILES.users),
    []
  );
  await copyIfMissing(
    path2.join(config.generatedDataDir, ENTITY_FILES.churches),
    path2.join(config.runtimeDataDir, ENTITY_FILES.churches),
    []
  );
  await copyIfMissing(
    path2.join(config.generatedDataDir, ENTITY_FILES.pastors),
    path2.join(config.runtimeDataDir, ENTITY_FILES.pastors),
    []
  );
  await copyIfMissing(
    path2.join(config.generatedDataDir, ENTITY_FILES.members),
    path2.join(config.runtimeDataDir, ENTITY_FILES.members),
    []
  );
  await copyIfMissing(
    path2.join(config.runtimeDataDir, ENTITY_FILES.insightCache),
    path2.join(config.runtimeDataDir, ENTITY_FILES.insightCache),
    []
  );
  await copyIfMissing(
    path2.join(config.runtimeDataDir, ENTITY_FILES.meta),
    path2.join(config.runtimeDataDir, ENTITY_FILES.meta),
    { seedVersion: "v1", lastResetAt: (/* @__PURE__ */ new Date()).toISOString() }
  );
};
var loadLocalDb = async () => {
  const config = getConfig();
  await ensureLocalDbInitialized();
  return {
    users: await readJson(path2.join(config.runtimeDataDir, ENTITY_FILES.users), []),
    churches: await readJson(path2.join(config.runtimeDataDir, ENTITY_FILES.churches), []),
    pastors: await readJson(path2.join(config.runtimeDataDir, ENTITY_FILES.pastors), []),
    members: await readJson(path2.join(config.runtimeDataDir, ENTITY_FILES.members), []),
    insightCache: await readJson(path2.join(config.runtimeDataDir, ENTITY_FILES.insightCache), []),
    meta: await readJson(path2.join(config.runtimeDataDir, ENTITY_FILES.meta), {
      seedVersion: "v1",
      lastResetAt: (/* @__PURE__ */ new Date()).toISOString()
    })
  };
};
var persistLocalDb = async (db) => {
  const config = getConfig();
  await writeJson(path2.join(config.runtimeDataDir, ENTITY_FILES.users), db.users);
  await writeJson(path2.join(config.runtimeDataDir, ENTITY_FILES.churches), db.churches);
  await writeJson(path2.join(config.runtimeDataDir, ENTITY_FILES.pastors), db.pastors);
  await writeJson(path2.join(config.runtimeDataDir, ENTITY_FILES.members), db.members);
  await writeJson(path2.join(config.runtimeDataDir, ENTITY_FILES.insightCache), db.insightCache);
  await writeJson(path2.join(config.runtimeDataDir, ENTITY_FILES.meta), db.meta);
};

// src/lib/repository.ts
var streamBodyToString = async (body) => {
  if (body && typeof body === "object" && "transformToString" in body && typeof body.transformToString === "function") {
    return body.transformToString();
  }
  return "";
};
var LocalRepository = class {
  async getUserById(userId) {
    const db = await loadLocalDb();
    return db.users.find((item) => item.userId === userId) ?? null;
  }
  async getUserByEmail(email) {
    const normalizedEmail = email.trim().toLowerCase();
    const db = await loadLocalDb();
    return db.users.find((item) => item.email.trim().toLowerCase() === normalizedEmail) ?? null;
  }
  async listChurches() {
    return (await loadLocalDb()).churches;
  }
  async getChurchById(churchId) {
    const db = await loadLocalDb();
    return db.churches.find((item) => item.churchId === churchId) ?? null;
  }
  async upsertChurch(church) {
    const db = await loadLocalDb();
    db.churches = db.churches.filter((item) => item.churchId !== church.churchId);
    db.churches.push(church);
    await persistLocalDb(db);
    return church;
  }
  async listPastors() {
    return (await loadLocalDb()).pastors;
  }
  async listPastorsByChurch(churchId) {
    const db = await loadLocalDb();
    return db.pastors.filter((item) => item.churchId === churchId);
  }
  async getPastorById(pastorId) {
    const db = await loadLocalDb();
    return db.pastors.find((item) => item.pastorId === pastorId) ?? null;
  }
  async upsertPastor(pastor) {
    const db = await loadLocalDb();
    db.pastors = db.pastors.filter((item) => item.pastorId !== pastor.pastorId);
    db.pastors.push(pastor);
    await persistLocalDb(db);
    return pastor;
  }
  async listMembers() {
    return (await loadLocalDb()).members;
  }
  async listMembersByChurch(churchId) {
    const db = await loadLocalDb();
    return db.members.filter((item) => item.churchId === churchId);
  }
  async getMemberById(memberId) {
    const db = await loadLocalDb();
    return db.members.find((item) => item.memberId === memberId) ?? null;
  }
  async upsertMember(member) {
    const db = await loadLocalDb();
    db.members = db.members.filter((item) => item.memberId !== member.memberId);
    db.members.push(member);
    await persistLocalDb(db);
    return member;
  }
  async getCachedInsight(cacheKey) {
    const db = await loadLocalDb();
    return db.insightCache.find((item) => item.cacheKey === cacheKey) ?? null;
  }
  async putCachedInsight(record) {
    const db = await loadLocalDb();
    db.insightCache = db.insightCache.filter((item) => item.cacheKey !== record.cacheKey);
    db.insightCache.push(record);
    await persistLocalDb(db);
  }
};
var DynamoRepository = class {
  config = getConfig();
  documentClient;
  s3Client;
  constructor() {
    this.documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: this.config.awsRegion }),
      { marshallOptions: { removeUndefinedValues: true } }
    );
    this.s3Client = this.config.insightCacheBucket ? new S3Client({ region: this.config.awsRegion }) : null;
  }
  async scanAll(tableName) {
    const items = [];
    let lastKey;
    do {
      const response = await this.documentClient.send(new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey
      }));
      items.push(...response.Items ?? []);
      lastKey = response.LastEvaluatedKey;
    } while (lastKey);
    return items;
  }
  async getUserById(userId) {
    const response = await this.documentClient.send(new GetCommand({
      TableName: this.config.usersTableName,
      Key: { userId }
    }));
    return response.Item ?? null;
  }
  async getUserByEmail(email) {
    const users = await this.scanAll(this.config.usersTableName);
    const normalizedEmail = email.trim().toLowerCase();
    return users.find((item) => item.email.trim().toLowerCase() === normalizedEmail) ?? null;
  }
  async listChurches() {
    return this.scanAll(this.config.churchesTableName);
  }
  async getChurchById(churchId) {
    const response = await this.documentClient.send(new GetCommand({
      TableName: this.config.churchesTableName,
      Key: { churchId }
    }));
    return response.Item ?? null;
  }
  async upsertChurch(church) {
    await this.documentClient.send(new PutCommand({ TableName: this.config.churchesTableName, Item: church }));
    return church;
  }
  async listPastors() {
    return this.scanAll(this.config.pastorsTableName);
  }
  async listPastorsByChurch(churchId) {
    return (await this.listPastors()).filter((item) => item.churchId === churchId);
  }
  async getPastorById(pastorId) {
    const response = await this.documentClient.send(new GetCommand({
      TableName: this.config.pastorsTableName,
      Key: { pastorId }
    }));
    return response.Item ?? null;
  }
  async upsertPastor(pastor) {
    await this.documentClient.send(new PutCommand({ TableName: this.config.pastorsTableName, Item: pastor }));
    return pastor;
  }
  async listMembers() {
    return this.scanAll(this.config.membersTableName);
  }
  async listMembersByChurch(churchId) {
    return (await this.listMembers()).filter((item) => item.churchId === churchId);
  }
  async getMemberById(memberId) {
    const response = await this.documentClient.send(new GetCommand({
      TableName: this.config.membersTableName,
      Key: { memberId }
    }));
    return response.Item ?? null;
  }
  async upsertMember(member) {
    await this.documentClient.send(new PutCommand({ TableName: this.config.membersTableName, Item: member }));
    return member;
  }
  async getCachedInsight(cacheKey) {
    if (!this.s3Client || !this.config.insightCacheBucket) {
      return null;
    }
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.config.insightCacheBucket,
        Key: `insights-cache/${cacheKey}.json`
      }));
      return JSON.parse(await streamBodyToString(response.Body));
    } catch {
      return null;
    }
  }
  async putCachedInsight(record) {
    if (!this.s3Client || !this.config.insightCacheBucket) {
      return;
    }
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.insightCacheBucket,
      Key: `insights-cache/${record.cacheKey}.json`,
      Body: JSON.stringify(record),
      ContentType: "application/json"
    }));
  }
};
var repositorySingleton = null;
var createRepository = () => {
  if (!repositorySingleton) {
    repositorySingleton = getConfig().dataSource === "dynamodb" ? new DynamoRepository() : new LocalRepository();
  }
  return repositorySingleton;
};

// src/app.ts
var repository = createRepository();
var churchInputSchema = churchSchema.pick({
  name: true,
  state: true,
  district: true,
  city: true,
  address: true,
  lat: true,
  lng: true,
  status: true
}).extend({
  pastorId: z.string().nullable().optional()
});
var pastorInputSchema = pastorSchema.pick({
  fullName: true,
  phone: true,
  joinedAt: true
}).extend({
  baptized: z.boolean().optional(),
  notes: z.string().optional()
});
var memberInputSchema = memberSchema.pick({
  fullName: true,
  phone: true,
  age: true,
  joinedAt: true,
  baptized: true,
  gender: true
});
var jsonError = (message, status = 400) => Response.json({ message }, { status });
var parseJsonBody = async (request, schema) => {
  const json = await request.json();
  return schema.parse(json);
};
var loadScopedData = async (user, filters) => {
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
    members: allMembers.filter((member) => churchIds.has(member.churchId))
  };
};
var app = new Hono();
app.use("*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization", "x-demo-user-id"],
  allowMethods: ["GET", "POST", "PUT", "OPTIONS"]
}));
app.get("/health", (c) => c.json({
  ok: true,
  mode: getConfig().dataSource,
  port: getConfig().port
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
  const filters = dashboardFiltersSchema2.parse(c.req.query());
  const scoped = await loadScopedData(user, filters);
  const overview = dashboardOverviewSchema.parse(
    buildDashboardOverview(
      scoped.filteredChurches,
      scoped.pastors,
      scoped.members,
      scoped.accessibleChurches,
      filters
    )
  );
  return c.json(overview);
});
app.get("/churches", async (c) => {
  const user = await getCurrentUser(c, repository);
  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }
  const filters = dashboardFiltersSchema2.parse(c.req.query());
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
    analytics: buildChurchAnalytics(members)
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
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const church = churchSchema.parse({
    ...input,
    churchId: `church-${crypto2.randomUUID()}`,
    createdAt: now,
    updatedAt: now
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
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
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
    pastorId: `pastor-${crypto2.randomUUID()}`,
    churchId,
    ...input
  });
  await repository.upsertPastor(pastor);
  if (!church.pastorId) {
    await repository.upsertChurch({ ...church, pastorId: pastor.pastorId, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
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
    memberId: `member-${crypto2.randomUUID()}`,
    churchId,
    ...input
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
    body.filters
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

// src/lambda.ts
var handler = handle(app);
export {
  handler
};
