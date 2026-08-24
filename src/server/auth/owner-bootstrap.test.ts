// @vitest-environment node

import { describe, expect, it } from "vitest";

import { bootstrapOwner } from "@/server/auth/owner-bootstrap";
import { verifyPassword } from "@/server/auth/password";

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
    if (this.owners.size > 0) {
      throw { code: "P2002" };
    }

    this.owners.set(data.email, data);
    return data;
  }

  count() {
    return this.owners.size;
  }
}

describe("bootstrapOwner", () => {
  it("creates one owner when the bootstrap is repeated with a differently cased email", async () => {
    const owners = new InMemoryOwnerStore();

    await bootstrapOwner({
      email: "Owner@Example.COM",
      password: "owner-passphrase-2026",
      owners,
    });
    await bootstrapOwner({
      email: " owner@example.com ",
      password: "owner-passphrase-2026",
      owners,
    });

    expect(owners.count()).toBe(1);
    const owner = await owners.findUnique({
      where: { email: "owner@example.com" },
    });
    expect(owner?.email).toBe("owner@example.com");
    await expect(
      verifyPassword("owner-passphrase-2026", owner?.passwordHash ?? ""),
    ).resolves.toBe(true);
  });

  it("keeps the existing owner when bootstrap is run with a different email", async () => {
    const owners = new InMemoryOwnerStore();

    await bootstrapOwner({
      email: "owner@example.com",
      password: "owner-passphrase-2026",
      owners,
    });
    await bootstrapOwner({
      email: "second-owner@example.com",
      password: "another-owner-passphrase",
      owners,
    });

    expect(owners.count()).toBe(1);
    expect(
      await owners.findUnique({ where: { email: "owner@example.com" } }),
    ).not.toBeNull();
    expect(
      await owners.findUnique({ where: { email: "second-owner@example.com" } }),
    ).toBeNull();
  });

  it("keeps one owner when different-email bootstraps race", async () => {
    const owners = new InMemoryOwnerStore();

    await Promise.all([
      bootstrapOwner({
        email: "owner@example.com",
        password: "owner-passphrase-2026",
        owners,
      }),
      bootstrapOwner({
        email: "second-owner@example.com",
        password: "another-owner-passphrase",
        owners,
      }),
    ]);

    expect(owners.count()).toBe(1);
  });

  it("returns only creation state for new, existing, and racing bootstraps", async () => {
    const owners = new InMemoryOwnerStore();

    const created = await bootstrapOwner({
      email: "owner@example.com",
      password: "owner-passphrase-2026",
      owners,
    });
    const existing = await bootstrapOwner({
      email: "owner@example.com",
      password: "owner-passphrase-2026",
      owners,
    });
    const racingOwners = new InMemoryOwnerStore();
    const racingResults = await Promise.all([
      bootstrapOwner({
        email: "owner@example.com",
        password: "owner-passphrase-2026",
        owners: racingOwners,
      }),
      bootstrapOwner({
        email: "second-owner@example.com",
        password: "another-owner-passphrase",
        owners: racingOwners,
      }),
    ]);

    expect(created).toEqual({ created: true });
    expect(existing).toEqual({ created: false });
    expect(racingResults).toEqual(
      expect.arrayContaining([{ created: true }, { created: false }]),
    );
  });
});
