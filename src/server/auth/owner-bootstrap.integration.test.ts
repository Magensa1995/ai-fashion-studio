// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { runOwnerBootstrap } from "../../../scripts/bootstrap-owner";
import { verifyPassword } from "@/server/auth/password";
import {
  createTestDatabaseClient,
  getTestDatabaseUrl,
} from "@/server/db/test-client";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const databaseSuite = describe.skipIf(!hasTestDatabase);
const ownerEmail = "owner@example.com";

databaseSuite("owner bootstrap database integration", () => {
  let database: ReturnType<typeof createTestDatabaseClient>;

  beforeAll(() => {
    getTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    database = createTestDatabaseClient();
  });

  beforeEach(async () => {
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
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("runs the bootstrap command twice and persists exactly one normalized owner", async () => {
    const messages: string[] = [];

    await runOwnerBootstrap({
      source: {
        OWNER_EMAIL: "Owner@Example.COM",
        OWNER_PASSWORD: "owner-passphrase-2026",
      },
      owners: database.user,
      write: (message) => messages.push(message),
    });
    await runOwnerBootstrap({
      source: {
        OWNER_EMAIL: " owner@example.com ",
        OWNER_PASSWORD: "owner-passphrase-2026",
      },
      owners: database.user,
      write: (message) => messages.push(message),
    });

    expect(await database.user.count({ where: { email: ownerEmail } })).toBe(1);
    const owner = await database.user.findUniqueOrThrow({
      where: { email: ownerEmail },
    });
    await expect(
      verifyPassword("owner-passphrase-2026", owner.passwordHash),
    ).resolves.toBe(true);
    expect(messages.join("\n")).not.toContain("owner-passphrase-2026");
    expect(messages.join("\n")).not.toContain(owner.passwordHash);
  });

  it("keeps the first owner when a later command supplies a different email", async () => {
    await runOwnerBootstrap({
      source: {
        OWNER_EMAIL: ownerEmail,
        OWNER_PASSWORD: "owner-passphrase-2026",
      },
      owners: database.user,
      write: () => undefined,
    });
    await runOwnerBootstrap({
      source: {
        OWNER_EMAIL: "second-owner@example.com",
        OWNER_PASSWORD: "another-owner-passphrase",
      },
      owners: database.user,
      write: () => undefined,
    });

    expect(await database.user.count()).toBe(1);
    await expect(
      database.user.findUnique({
        where: { email: "second-owner@example.com" },
      }),
    ).resolves.toBeNull();
  });

  it("keeps one owner when different-email bootstrap commands race", async () => {
    await Promise.all([
      runOwnerBootstrap({
        source: {
          OWNER_EMAIL: ownerEmail,
          OWNER_PASSWORD: "owner-passphrase-2026",
        },
        owners: database.user,
        write: () => undefined,
      }),
      runOwnerBootstrap({
        source: {
          OWNER_EMAIL: "second-owner@example.com",
          OWNER_PASSWORD: "another-owner-passphrase",
        },
        owners: database.user,
        write: () => undefined,
      }),
    ]);

    expect(await database.user.count()).toBe(1);
  });

  it("database constraints reject a second owner with a different singleton key", async () => {
    await runOwnerBootstrap({
      source: {
        OWNER_EMAIL: ownerEmail,
        OWNER_PASSWORD: "owner-passphrase-2026",
      },
      owners: database.user,
      write: () => undefined,
    });

    await expect(
      database.user.create({
        data: {
          email: "second-owner@example.com",
          passwordHash: "not-a-real-password-hash",
          ownerSingletonKey: 2,
        },
      }),
    ).rejects.toBeDefined();
    expect(await database.user.count()).toBe(1);
  });
});
