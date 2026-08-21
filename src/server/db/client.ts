import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { getServerEnv } from "@/config/env";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDatabase = globalThis as unknown as {
  databaseClient?: PrismaClient;
};

function createDatabaseClient() {
  const connectionString = getServerEnv().DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required when the database client is used.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export function getDatabaseClient() {
  const client = globalForDatabase.databaseClient ?? createDatabaseClient();

  if (process.env.NODE_ENV !== "production") {
    globalForDatabase.databaseClient = client;
  }

  return client;
}
