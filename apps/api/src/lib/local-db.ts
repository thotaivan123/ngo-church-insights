import fs from "node:fs/promises";
import path from "node:path";

import { getConfig } from "../config";
import type { LocalDatabase } from "../types";

const ENTITY_FILES = {
  users: "users.json",
  churches: "churches.json",
  pastors: "pastors.json",
  members: "members.json",
  insightCache: "insight-cache.json",
  meta: "meta.json",
} as const;

const readJson = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const copyIfMissing = async (sourcePath: string, targetPath: string, fallback: unknown): Promise<void> => {
  try {
    await fs.access(targetPath);
  } catch {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    try {
      const contents = await fs.readFile(sourcePath, "utf-8");
      await fs.writeFile(targetPath, contents, "utf-8");
    } catch {
      await writeJson(targetPath, fallback);
    }
  }
};

export const resetLocalDbFromGenerated = async (): Promise<void> => {
  const config = getConfig();
  await fs.mkdir(config.runtimeDataDir, { recursive: true });

  for (const key of ["users", "churches", "pastors", "members"] as const) {
    try {
      const contents = await fs.readFile(path.join(config.generatedDataDir, ENTITY_FILES[key]), "utf-8");
      await fs.writeFile(path.join(config.runtimeDataDir, ENTITY_FILES[key]), contents, "utf-8");
    } catch {
      await writeJson(path.join(config.runtimeDataDir, ENTITY_FILES[key]), []);
    }
  }

  await writeJson(path.join(config.runtimeDataDir, ENTITY_FILES.insightCache), []);
  await writeJson(path.join(config.runtimeDataDir, ENTITY_FILES.meta), {
    seedVersion: "v1",
    lastResetAt: new Date().toISOString(),
  });
};

export const ensureLocalDbInitialized = async (): Promise<void> => {
  const config = getConfig();
  await fs.mkdir(config.runtimeDataDir, { recursive: true });

  await copyIfMissing(
    path.join(config.generatedDataDir, ENTITY_FILES.users),
    path.join(config.runtimeDataDir, ENTITY_FILES.users),
    [],
  );
  await copyIfMissing(
    path.join(config.generatedDataDir, ENTITY_FILES.churches),
    path.join(config.runtimeDataDir, ENTITY_FILES.churches),
    [],
  );
  await copyIfMissing(
    path.join(config.generatedDataDir, ENTITY_FILES.pastors),
    path.join(config.runtimeDataDir, ENTITY_FILES.pastors),
    [],
  );
  await copyIfMissing(
    path.join(config.generatedDataDir, ENTITY_FILES.members),
    path.join(config.runtimeDataDir, ENTITY_FILES.members),
    [],
  );
  await copyIfMissing(
    path.join(config.runtimeDataDir, ENTITY_FILES.insightCache),
    path.join(config.runtimeDataDir, ENTITY_FILES.insightCache),
    [],
  );
  await copyIfMissing(
    path.join(config.runtimeDataDir, ENTITY_FILES.meta),
    path.join(config.runtimeDataDir, ENTITY_FILES.meta),
    { seedVersion: "v1", lastResetAt: new Date().toISOString() },
  );
};

export const loadLocalDb = async (): Promise<LocalDatabase> => {
  const config = getConfig();
  await ensureLocalDbInitialized();
  return {
    users: await readJson(path.join(config.runtimeDataDir, ENTITY_FILES.users), []),
    churches: await readJson(path.join(config.runtimeDataDir, ENTITY_FILES.churches), []),
    pastors: await readJson(path.join(config.runtimeDataDir, ENTITY_FILES.pastors), []),
    members: await readJson(path.join(config.runtimeDataDir, ENTITY_FILES.members), []),
    insightCache: await readJson(path.join(config.runtimeDataDir, ENTITY_FILES.insightCache), []),
    meta: await readJson(path.join(config.runtimeDataDir, ENTITY_FILES.meta), {
      seedVersion: "v1",
      lastResetAt: new Date().toISOString(),
    }),
  };
};

export const persistLocalDb = async (db: LocalDatabase): Promise<void> => {
  const config = getConfig();
  await writeJson(path.join(config.runtimeDataDir, ENTITY_FILES.users), db.users);
  await writeJson(path.join(config.runtimeDataDir, ENTITY_FILES.churches), db.churches);
  await writeJson(path.join(config.runtimeDataDir, ENTITY_FILES.pastors), db.pastors);
  await writeJson(path.join(config.runtimeDataDir, ENTITY_FILES.members), db.members);
  await writeJson(path.join(config.runtimeDataDir, ENTITY_FILES.insightCache), db.insightCache);
  await writeJson(path.join(config.runtimeDataDir, ENTITY_FILES.meta), db.meta);
};
