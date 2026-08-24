// @vitest-environment node

import { describe, expect, it } from "vitest";

import { requireUser, UnauthorizedError } from "@/server/auth/session";

describe("requireUser", () => {
  it("returns the authenticated owner ID", async () => {
    await expect(
      requireUser(async () => ({
        expires: "2026-08-24T00:00:00.000Z",
        user: { id: "owner_123" },
      })),
    ).resolves.toBe("owner_123");
  });

  it("throws an unauthorized application error for an anonymous request", async () => {
    await expect(requireUser(async () => null)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    } satisfies Pick<UnauthorizedError, "code" | "status">);
  });
});
