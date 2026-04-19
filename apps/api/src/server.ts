import { serve } from "@hono/node-server";

import { getConfig } from "./config";
import { app } from "./app";
import { ensureLocalDbInitialized } from "./lib/local-db";

const config = getConfig();

await ensureLocalDbInitialized();

serve({
  fetch: app.fetch,
  port: config.port,
});

console.log(`NGO Church Insights API listening on http://localhost:${config.port}`);
