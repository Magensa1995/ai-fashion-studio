// @vitest-environment node

import { createHook } from "node:async_hooks";

import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password utilities", () => {
  it("verifies a password against a stored self-describing hash", async () => {
    const password = "owner-passphrase-2026";

    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toContain(password);
    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const passwordHash = await hashPassword("owner-passphrase-2026");

    await expect(
      verifyPassword("incorrect-passphrase", passwordHash),
    ).resolves.toBe(false);
  });

  it("fails safely for a malformed stored hash", async () => {
    await expect(
      verifyPassword("owner-passphrase-2026", "not-a-password-hash"),
    ).resolves.toBe(false);
  });

  it("performs equivalent scrypt work for malformed hashes", async () => {
    const password = "owner-passphrase-2026";
    const passwordHash = await hashPassword(password);
    let scryptRequests = 0;
    const hook = createHook({
      init(_asyncId, type) {
        if (type === "SCRYPTREQUEST") {
          scryptRequests += 1;
        }
      },
    });

    hook.enable();
    let malformedHashRequests = 0;
    let validHashRequests = 0;

    try {
      await expect(
        verifyPassword(password, "not-a-password-hash"),
      ).resolves.toBe(false);
      malformedHashRequests = scryptRequests;
      scryptRequests = 0;
      await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
      validHashRequests = scryptRequests;
    } finally {
      hook.disable();
    }

    expect(validHashRequests).toBeGreaterThan(0);
    expect(malformedHashRequests).toBe(validHashRequests);
  });
});
