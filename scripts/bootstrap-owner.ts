import "dotenv/config";

import { pathToFileURL } from "node:url";

import { parseOwnerBootstrapEnv } from "@/config/env";
import { bootstrapOwner, type OwnerStore } from "@/server/auth/owner-bootstrap";
import { getDatabaseClient } from "@/server/db/client";

type RunOwnerBootstrapOptions = {
  source: Record<string, string | undefined>;
  owners: OwnerStore;
  write: (message: string) => void;
};

type OwnerDatabase = {
  $disconnect(): Promise<void>;
  user: OwnerStore;
};

type RunOwnerBootstrapCommandOptions = {
  database: OwnerDatabase;
  source: Record<string, string | undefined>;
  write: (message: string) => void;
};

export async function runOwnerBootstrap({
  source,
  owners,
  write,
}: RunOwnerBootstrapOptions) {
  const { OWNER_EMAIL, OWNER_PASSWORD } = parseOwnerBootstrapEnv(source);
  const { created } = await bootstrapOwner({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    owners,
  });

  write(
    created ? "Owner bootstrap created." : "Owner bootstrap already exists.",
  );
}

export async function runOwnerBootstrapCommand({
  database,
  source,
  write,
}: RunOwnerBootstrapCommandOptions) {
  try {
    await runOwnerBootstrap({ source, owners: database.user, write });
  } finally {
    await database.$disconnect();
  }
}

async function main() {
  await runOwnerBootstrapCommand({
    database: getDatabaseClient(),
    source: process.env,
    write: (message) => console.info(message),
  });
}

const scriptPath = process.argv[1];

if (scriptPath && import.meta.url === pathToFileURL(scriptPath).href) {
  void main().catch(() => {
    console.error("Owner bootstrap failed.");
    process.exitCode = 1;
  });
}
