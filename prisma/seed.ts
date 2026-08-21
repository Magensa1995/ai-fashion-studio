import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run the seed framework.");
  }

  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    console.info(
      "Seed framework ready; owner creation is introduced in Phase 1.",
    );
  } finally {
    await database.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
