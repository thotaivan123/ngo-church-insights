import { serve } from "@hono/node-server";

import { loadLocalEnv } from "./lib/load-env";

loadLocalEnv();

const [{ getConfig }, { app }, { ensureLocalDbInitialized }, { hydrateCognitoVerifier }] = await Promise.all([
  import("./config"),
  import("./app"),
  import("./lib/local-db"),
  import("./lib/auth"),
]);

const config = getConfig();

await ensureLocalDbInitialized();

if (config.cognitoUserPoolId && config.cognitoClientId) {
  try {
    await hydrateCognitoVerifier();
    console.log("Cognito JWKS cache hydrated for local API startup");
  } catch (error) {
    console.warn(
      `Cognito JWKS hydration skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

serve({
  fetch: app.fetch,
  port: config.port,
});

console.log(`NGO Church Insights API listening on http://localhost:${config.port}`);
