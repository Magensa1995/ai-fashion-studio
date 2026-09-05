import "dotenv/config";

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { getTestDatabaseUrl } from "../src/server/db/test-client";

const testDatabaseUrl = getTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const prismaCli = fileURLToPath(
  new URL("../node_modules/prisma/build/index.js", import.meta.url),
);

execFileSync(process.execPath, [prismaCli, "migrate", "reset", "--force"], {
  env: {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
  },
  stdio: "inherit",
});
