// @vitest-environment node

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { runOwnerBootstrap } from "../../../scripts/bootstrap-owner";
import {
  createTestDatabaseClient,
  getTestDatabaseUrl,
} from "@/server/db/test-client";
const productionAuthSecret =
  "production-test-secret-with-at-least-32-characters";

let server: ChildProcessWithoutNullStreams | undefined;
let baseUrl = "";
let serverOutput = "";
const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const databaseSuite = describe.skipIf(!hasTestDatabase);

async function clearRuntimeTestDatabase(
  database: ReturnType<typeof createTestDatabaseClient>,
) {
  await database.$transaction([
    database.postMedia.deleteMany(),
    database.post.deleteMany(),
    database.generatedImage.deleteMany(),
    database.generation.deleteMany(),
    database.generationPreset.deleteMany(),
    database.productImage.deleteMany(),
    database.modelImage.deleteMany(),
    database.product.deleteMany(),
    database.modelProfile.deleteMany(),
    database.media.deleteMany(),
    database.user.deleteMany(),
  ]);
}

function reservePort() {
  return new Promise<number>((resolve, reject) => {
    const portServer = createServer();
    portServer.once("error", reject);
    portServer.listen(0, "127.0.0.1", () => {
      const address = portServer.address();

      if (!address || typeof address === "string") {
        reject(new Error("Could not reserve a local test port."));
        return;
      }

      portServer.close((error) =>
        error ? reject(error) : resolve(address.port),
      );
    });
  });
}

async function waitForServer(url: string) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Next production server did not start.\n${serverOutput}`);
}

beforeAll(async () => {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const environment = { ...process.env };

  delete environment.AUTH_TRUST_HOST;
  delete environment.AUTH_URL;
  delete environment.NEXTAUTH_URL;
  delete environment.VERCEL;
  delete environment.CF_PAGES;
  environment.AUTH_SECRET = productionAuthSecret;
  environment.AUTH_TRUST_HOST = "true";
  if (process.env.TEST_DATABASE_URL) {
    environment.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }
  environment.NODE_ENV = "production";

  server = spawn(
    process.execPath,
    [
      join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
      "start",
      "-p",
      String(port),
    ],
    { cwd: process.cwd(), env: environment, shell: false },
  );
  server.stdout.setEncoding("utf8");
  server.stderr.setEncoding("utf8");
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk;
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk;
  });

  await waitForServer(`${baseUrl}/api/auth/providers`);
}, 30_000);

afterAll(async () => {
  if (!server || server.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    server?.once("close", () => resolve());
    server?.kill();
  });
});

describe("production Auth.js route runtime", () => {
  it("serves provider discovery and an anonymous session with documented production configuration", async () => {
    const providers = await fetch(`${baseUrl}/api/auth/providers`);
    const session = await fetch(`${baseUrl}/api/auth/session`);

    expect(providers.status).toBe(200);
    expect(await providers.json()).toMatchObject({
      credentials: {
        id: "credentials",
        name: "Credentials",
        type: "credentials",
      },
    });
    expect(session.status).toBe(200);
    expect(await session.json()).toBeNull();
  }, 30_000);
});

databaseSuite("production Auth.js credentials route runtime", () => {
  let database: ReturnType<typeof createTestDatabaseClient>;

  beforeAll(() => {
    getTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    database = createTestDatabaseClient();
  });

  beforeEach(async () => {
    await clearRuntimeTestDatabase(database);
    await runOwnerBootstrap({
      source: {
        OWNER_EMAIL: "owner@example.com",
        OWNER_PASSWORD: "owner-passphrase-2026",
      },
      owners: database.user,
      write: () => undefined,
    });
  });

  afterAll(async () => {
    try {
      await clearRuntimeTestDatabase(database);
    } finally {
      await database.$disconnect();
    }
  });

  async function credentialsCallback(email: string, password: string) {
    const csrf = await fetch(`${baseUrl}/api/auth/csrf`);
    const csrfPayload = (await csrf.json()) as { csrfToken: string };
    const csrfCookies = csrf.headers
      .getSetCookie()
      .map((value) => value.split(";")[0]);
    const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: csrfCookies.join("; "),
        "x-auth-return-redirect": "1",
      },
      body: new URLSearchParams({
        callbackUrl: `${baseUrl}/`,
        csrfToken: csrfPayload.csrfToken,
        email,
        password,
      }),
    });

    return response;
  }

  it("creates a minimal owner session through the real credentials callback", async () => {
    const callback = await credentialsCallback(
      "Owner@Example.COM",
      "owner-passphrase-2026",
    );
    const sessionCookie = callback.headers
      .getSetCookie()
      .find((value) => value.startsWith("__Secure-authjs.session-token="));

    expect(callback.status).toBe(200);
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(sessionCookie).toContain("Secure");

    const session = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: sessionCookie?.split(";")[0] ?? "" },
    });
    const sessionPayload = await session.json();

    expect(session.status).toBe(200);
    expect(sessionPayload).toMatchObject({ user: { id: expect.any(String) } });
    expect(JSON.stringify(sessionPayload)).not.toContain("owner@example.com");
  }, 30_000);

  it("returns the same generic credential failure for wrong and missing owners", async () => {
    const wrongPassword = await credentialsCallback(
      "owner@example.com",
      "wrong-passphrase",
    );
    const missingOwner = await credentialsCallback(
      "missing@example.com",
      "wrong-passphrase",
    );

    expect(wrongPassword.status).toBe(missingOwner.status);
    expect(await wrongPassword.json()).toEqual(await missingOwner.json());
  }, 30_000);
});

databaseSuite("production Auth.js credentials runtime cleanup", () => {
  it("removes the bootstrapped owner after the runtime suite", async () => {
    getTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    const database = createTestDatabaseClient();

    try {
      await expect(
        database.user.findUnique({ where: { email: "owner@example.com" } }),
      ).resolves.toBeNull();
    } finally {
      await database.$disconnect();
    }
  });
});
