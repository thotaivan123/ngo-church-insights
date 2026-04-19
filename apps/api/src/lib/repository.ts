import type {
  Church,
  Member,
  Pastor,
  UserProfile,
} from "@ngo/shared";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

import { getConfig } from "../config";
import type { CachedInsightRecord } from "../types";
import { loadLocalDb, persistLocalDb } from "./local-db";

export type AppRepository = {
  getUserById: (userId: string) => Promise<UserProfile | null>;
  listChurches: () => Promise<Church[]>;
  getChurchById: (churchId: string) => Promise<Church | null>;
  upsertChurch: (church: Church) => Promise<Church>;
  listPastors: () => Promise<Pastor[]>;
  listPastorsByChurch: (churchId: string) => Promise<Pastor[]>;
  getPastorById: (pastorId: string) => Promise<Pastor | null>;
  upsertPastor: (pastor: Pastor) => Promise<Pastor>;
  listMembers: () => Promise<Member[]>;
  listMembersByChurch: (churchId: string) => Promise<Member[]>;
  getMemberById: (memberId: string) => Promise<Member | null>;
  upsertMember: (member: Member) => Promise<Member>;
  getCachedInsight: (cacheKey: string) => Promise<CachedInsightRecord | null>;
  putCachedInsight: (record: CachedInsightRecord) => Promise<void>;
};

const streamBodyToString = async (body: unknown): Promise<string> => {
  if (body && typeof body === "object" && "transformToString" in body && typeof body.transformToString === "function") {
    return body.transformToString();
  }
  return "";
};

class LocalRepository implements AppRepository {
  async getUserById(userId: string): Promise<UserProfile | null> {
    const db = await loadLocalDb();
    return db.users.find((item) => item.userId === userId) ?? null;
  }

  async listChurches(): Promise<Church[]> {
    return (await loadLocalDb()).churches;
  }

  async getChurchById(churchId: string): Promise<Church | null> {
    const db = await loadLocalDb();
    return db.churches.find((item) => item.churchId === churchId) ?? null;
  }

  async upsertChurch(church: Church): Promise<Church> {
    const db = await loadLocalDb();
    db.churches = db.churches.filter((item) => item.churchId !== church.churchId);
    db.churches.push(church);
    await persistLocalDb(db);
    return church;
  }

  async listPastors(): Promise<Pastor[]> {
    return (await loadLocalDb()).pastors;
  }

  async listPastorsByChurch(churchId: string): Promise<Pastor[]> {
    const db = await loadLocalDb();
    return db.pastors.filter((item) => item.churchId === churchId);
  }

  async getPastorById(pastorId: string): Promise<Pastor | null> {
    const db = await loadLocalDb();
    return db.pastors.find((item) => item.pastorId === pastorId) ?? null;
  }

  async upsertPastor(pastor: Pastor): Promise<Pastor> {
    const db = await loadLocalDb();
    db.pastors = db.pastors.filter((item) => item.pastorId !== pastor.pastorId);
    db.pastors.push(pastor);
    await persistLocalDb(db);
    return pastor;
  }

  async listMembers(): Promise<Member[]> {
    return (await loadLocalDb()).members;
  }

  async listMembersByChurch(churchId: string): Promise<Member[]> {
    const db = await loadLocalDb();
    return db.members.filter((item) => item.churchId === churchId);
  }

  async getMemberById(memberId: string): Promise<Member | null> {
    const db = await loadLocalDb();
    return db.members.find((item) => item.memberId === memberId) ?? null;
  }

  async upsertMember(member: Member): Promise<Member> {
    const db = await loadLocalDb();
    db.members = db.members.filter((item) => item.memberId !== member.memberId);
    db.members.push(member);
    await persistLocalDb(db);
    return member;
  }

  async getCachedInsight(cacheKey: string): Promise<CachedInsightRecord | null> {
    const db = await loadLocalDb();
    return db.insightCache.find((item) => item.cacheKey === cacheKey) ?? null;
  }

  async putCachedInsight(record: CachedInsightRecord): Promise<void> {
    const db = await loadLocalDb();
    db.insightCache = db.insightCache.filter((item) => item.cacheKey !== record.cacheKey);
    db.insightCache.push(record);
    await persistLocalDb(db);
  }
}

class DynamoRepository implements AppRepository {
  private readonly config = getConfig();

  private readonly documentClient: DynamoDBDocumentClient;

  private readonly s3Client: S3Client | null;

  constructor() {
    this.documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: this.config.awsRegion }),
      { marshallOptions: { removeUndefinedValues: true } },
    );
    this.s3Client = this.config.insightCacheBucket ? new S3Client({ region: this.config.awsRegion }) : null;
  }

  private async scanAll<T>(tableName: string): Promise<T[]> {
    const items: T[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const response = await this.documentClient.send(new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      }));
      items.push(...((response.Items ?? []) as T[]));
      lastKey = response.LastEvaluatedKey;
    } while (lastKey);
    return items;
  }

  async getUserById(userId: string): Promise<UserProfile | null> {
    const response = await this.documentClient.send(new GetCommand({
      TableName: this.config.usersTableName,
      Key: { userId },
    }));
    return (response.Item as UserProfile | undefined) ?? null;
  }

  async listChurches(): Promise<Church[]> {
    return this.scanAll<Church>(this.config.churchesTableName);
  }

  async getChurchById(churchId: string): Promise<Church | null> {
    const response = await this.documentClient.send(new GetCommand({
      TableName: this.config.churchesTableName,
      Key: { churchId },
    }));
    return (response.Item as Church | undefined) ?? null;
  }

  async upsertChurch(church: Church): Promise<Church> {
    await this.documentClient.send(new PutCommand({ TableName: this.config.churchesTableName, Item: church }));
    return church;
  }

  async listPastors(): Promise<Pastor[]> {
    return this.scanAll<Pastor>(this.config.pastorsTableName);
  }

  async listPastorsByChurch(churchId: string): Promise<Pastor[]> {
    return (await this.listPastors()).filter((item) => item.churchId === churchId);
  }

  async getPastorById(pastorId: string): Promise<Pastor | null> {
    const response = await this.documentClient.send(new GetCommand({
      TableName: this.config.pastorsTableName,
      Key: { pastorId },
    }));
    return (response.Item as Pastor | undefined) ?? null;
  }

  async upsertPastor(pastor: Pastor): Promise<Pastor> {
    await this.documentClient.send(new PutCommand({ TableName: this.config.pastorsTableName, Item: pastor }));
    return pastor;
  }

  async listMembers(): Promise<Member[]> {
    return this.scanAll<Member>(this.config.membersTableName);
  }

  async listMembersByChurch(churchId: string): Promise<Member[]> {
    return (await this.listMembers()).filter((item) => item.churchId === churchId);
  }

  async getMemberById(memberId: string): Promise<Member | null> {
    const response = await this.documentClient.send(new GetCommand({
      TableName: this.config.membersTableName,
      Key: { memberId },
    }));
    return (response.Item as Member | undefined) ?? null;
  }

  async upsertMember(member: Member): Promise<Member> {
    await this.documentClient.send(new PutCommand({ TableName: this.config.membersTableName, Item: member }));
    return member;
  }

  async getCachedInsight(cacheKey: string): Promise<CachedInsightRecord | null> {
    if (!this.s3Client || !this.config.insightCacheBucket) {
      return null;
    }
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.config.insightCacheBucket,
        Key: `insights-cache/${cacheKey}.json`,
      }));
      return JSON.parse(await streamBodyToString(response.Body)) as CachedInsightRecord;
    } catch {
      return null;
    }
  }

  async putCachedInsight(record: CachedInsightRecord): Promise<void> {
    if (!this.s3Client || !this.config.insightCacheBucket) {
      return;
    }
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.insightCacheBucket,
      Key: `insights-cache/${record.cacheKey}.json`,
      Body: JSON.stringify(record),
      ContentType: "application/json",
    }));
  }
}

let repositorySingleton: AppRepository | null = null;

export const createRepository = (): AppRepository => {
  if (!repositorySingleton) {
    repositorySingleton = getConfig().dataSource === "dynamodb"
      ? new DynamoRepository()
      : new LocalRepository();
  }
  return repositorySingleton;
};
