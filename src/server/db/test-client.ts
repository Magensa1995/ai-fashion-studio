import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

export function getTestDatabaseUrl(connectionString?: string) {
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }

  const databaseName = new URL(connectionString).pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      "TEST_DATABASE_URL must target a database whose name ends with _test.",
    );
  }

  return connectionString;
}

export function createTestDatabaseClient() {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: getTestDatabaseUrl(process.env.TEST_DATABASE_URL),
    }),
  });
}
