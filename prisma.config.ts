import "dotenv/config";

import { defineConfig } from "prisma/config";

const missingDatabaseUrl =
  "postgresql://missing:missing@127.0.0.1:5432/missing_database_url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? missingDatabaseUrl,
  },
});
