// @vitest-environment node

import { createHook } from "node:async_hooks";

import { describe, expect, it } from "vitest";

import { createAuthConfig } from "@/server/auth/config";
import { hashPassword } from "@/server/auth/password";

type Authorize = (
  credentials: Record<string, unknown>,
) => Promise<{ id: string } | null>;

function getAuthorize(config: ReturnType<typeof createAuthConfig>) {
  const provider = config.providers.find(
    (candidate) =>
      typeof candidate !== "function" && candidate.id === "credentials",
  ) as { options?: { authorize?: Authorize } } | undefined;

  if (!provider) {
    throw new Error("Credentials provider must define authorize.");
  }

  const authorize = provider.options?.authorize;

  if (!authorize) {
    throw new Error("Credentials provider must define authorize.");
  }

  return authorize;
}

describe("Credentials authorization", () => {
  it("returns only the owner ID for valid credentials", async () => {
    const passwordHash = await hashPassword("owner-passphrase-2026");
    const authorize = getAuthorize(
      createAuthConfig({
        environment: { AUTH_SECRET: "test-secret", NODE_ENV: "test" },
        findOwnerByEmail: async (email) =>
          email === "owner@example.com"
            ? { id: "owner_123", passwordHash }
            : null,
      }),
    );

    await expect(
      authorize({
        email: "owner@example.com",
        password: "owner-passphrase-2026",
      }),
    ).resolves.toEqual({ id: "owner_123" });
  });

  it("returns the same invalid result for a wrong password", async () => {
    const passwordHash = await hashPassword("owner-passphrase-2026");
    const authorize = getAuthorize(
      createAuthConfig({
        environment: { AUTH_SECRET: "test-secret", NODE_ENV: "test" },
        findOwnerByEmail: async () => ({ id: "owner_123", passwordHash }),
      }),
    );

    await expect(
      authorize({
        email: "owner@example.com",
        password: "incorrect-passphrase",
      }),
    ).resolves.toBeNull();
  });

  it("accepts a case-variant owner email", async () => {
    const passwordHash = await hashPassword("owner-passphrase-2026");
    const owners = new Map([
      ["owner@example.com", { id: "owner_123", passwordHash }],
    ]);
    const authorize = getAuthorize(
      createAuthConfig({
        environment: { AUTH_SECRET: "test-secret", NODE_ENV: "test" },
        findOwnerByEmail: async (email) => owners.get(email) ?? null,
      }),
    );

    await expect(
      authorize({
        email: "Owner@Example.COM",
        password: "owner-passphrase-2026",
      }),
    ).resolves.toEqual({ id: "owner_123" });
  });

  it("returns the same invalid result when the owner is missing", async () => {
    const authorize = getAuthorize(
      createAuthConfig({
        environment: { AUTH_SECRET: "test-secret", NODE_ENV: "test" },
        findOwnerByEmail: async () => null,
      }),
    );

    await expect(
      authorize({
        email: "missing@example.com",
        password: "owner-passphrase-2026",
      }),
    ).resolves.toBeNull();
  });

  it("performs equivalent password-verification work when the owner is missing", async () => {
    const passwordHash = await hashPassword("owner-passphrase-2026");
    const existingOwnerAuthorize = getAuthorize(
      createAuthConfig({
        environment: { AUTH_SECRET: "test-secret", NODE_ENV: "test" },
        findOwnerByEmail: async () => ({ id: "owner_123", passwordHash }),
      }),
    );
    const missingOwnerAuthorize = getAuthorize(
      createAuthConfig({
        environment: { AUTH_SECRET: "test-secret", NODE_ENV: "test" },
        findOwnerByEmail: async () => null,
      }),
    );
    let scryptRequests = 0;
    const hook = createHook({
      init(_asyncId, type) {
        if (type === "SCRYPTREQUEST") {
          scryptRequests += 1;
        }
      },
    });

    hook.enable();
    let existingOwnerRequests = 0;
    let missingOwnerRequests = 0;

    try {
      await existingOwnerAuthorize({
        email: "owner@example.com",
        password: "incorrect-passphrase",
      });
      existingOwnerRequests = scryptRequests;
      scryptRequests = 0;
      await missingOwnerAuthorize({
        email: "missing@example.com",
        password: "incorrect-passphrase",
      });
      missingOwnerRequests = scryptRequests;
    } finally {
      hook.disable();
    }

    expect(existingOwnerRequests).toBeGreaterThan(0);
    expect(missingOwnerRequests).toBe(existingOwnerRequests);
  });
});

describe("Auth.js session and cookie configuration", () => {
  it("passes explicitly configured host trust to Auth.js", () => {
    const config = createAuthConfig({
      environment: {
        AUTH_SECRET: "production-secret",
        AUTH_TRUST_HOST: true,
        NODE_ENV: "production",
      },
    });

    expect(config.trustHost).toBe(true);
  });

  it("exposes only the owner ID in a JWT-backed session", async () => {
    const config = createAuthConfig({
      environment: { AUTH_SECRET: "test-secret", NODE_ENV: "test" },
    });
    const session = await config.callbacks?.session?.({
      session: {
        expires: "2026-08-24T00:00:00.000Z",
        user: {
          email: "owner@example.com",
          image: "https://example.com/owner.png",
          name: "Owner",
        },
      },
      token: { email: "owner@example.com", name: "Owner", sub: "owner_123" },
    } as never);

    expect(session).toEqual({
      expires: "2026-08-24T00:00:00.000Z",
      user: { id: "owner_123" },
    });
  });

  it("uses secure HttpOnly Lax session cookies in production", () => {
    const config = createAuthConfig({
      environment: { AUTH_SECRET: "production-secret", NODE_ENV: "production" },
    });

    expect(config.cookies?.sessionToken).toMatchObject({
      name: "__Secure-authjs.session-token",
      options: { httpOnly: true, sameSite: "lax", secure: true },
    });
  });
});
