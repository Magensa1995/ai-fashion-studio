// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  runOwnerBootstrap,
  runOwnerBootstrapCommand,
} from "../../../scripts/bootstrap-owner";

type Owner = {
  email: string;
  passwordHash: string;
};

class InMemoryOwnerStore {
  private readonly owners = new Map<string, Owner>();

  async findUnique({ where: { email } }: { where: { email: string } }) {
    return this.owners.get(email) ?? null;
  }

  async findFirst() {
    return this.owners.values().next().value ?? null;
  }

  async create({ data }: { data: Owner }) {
    this.owners.set(data.email, data);
    return data;
  }
}

class InMemoryDatabase {
  readonly user = new InMemoryOwnerStore();
  disconnectCalls = 0;

  async $disconnect() {
    this.disconnectCalls += 1;
  }
}

describe("runOwnerBootstrap", () => {
  it("does not write the owner password or password hash to command output", async () => {
    const owners = new InMemoryOwnerStore();
    const messages: string[] = [];
    const password = "owner-passphrase-2026";

    await runOwnerBootstrap({
      source: {
        OWNER_EMAIL: "owner@example.com",
        OWNER_PASSWORD: password,
      },
      owners,
      write: (message) => messages.push(message),
    });

    const owner = await owners.findUnique({
      where: { email: "owner@example.com" },
    });
    expect(messages.join("\n")).not.toContain(password);
    expect(messages.join("\n")).not.toContain(owner?.passwordHash ?? "");
  });

  it("disconnects the database after a successful command", async () => {
    const database = new InMemoryDatabase();

    await runOwnerBootstrapCommand({
      source: {
        OWNER_EMAIL: "owner@example.com",
        OWNER_PASSWORD: "owner-passphrase-2026",
      },
      database,
      write: () => undefined,
    });

    expect(database.disconnectCalls).toBe(1);
  });

  it("disconnects the database after a failed command", async () => {
    const database = new InMemoryDatabase();

    await expect(
      runOwnerBootstrapCommand({
        source: {},
        database,
        write: () => undefined,
      }),
    ).rejects.toThrow();

    expect(database.disconnectCalls).toBe(1);
  });
});
