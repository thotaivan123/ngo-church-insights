import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const parseEnvLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  if (!key) {
    return null;
  }

  let value = trimmed.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith("\"") && value.endsWith("\""))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
};

export const loadLocalEnv = (): void => {
  const srcDir = path.dirname(fileURLToPath(import.meta.url));
  const apiRoot = path.resolve(srcDir, "..", "..");
  const envPath = path.join(apiRoot, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const contents = fs.readFileSync(envPath, "utf-8");
  contents
    .split(/\r?\n/)
    .map(parseEnvLine)
    .filter((entry): entry is [string, string] => Boolean(entry))
    .forEach(([key, value]) => {
      if (process.env[key] == null) {
        process.env[key] = value;
      }
    });
};
