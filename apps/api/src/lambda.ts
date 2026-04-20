import { handle } from "hono/aws-lambda";

import { loadLocalEnv } from "./lib/load-env";

loadLocalEnv();

const [{ app }, { hydrateCognitoVerifier }] = await Promise.all([
  import("./app"),
  import("./lib/auth"),
]);

try {
  await hydrateCognitoVerifier();
} catch {
  // Lambda can still lazily fetch the JWKS on first verification attempt.
}

export const handler = handle(app);
