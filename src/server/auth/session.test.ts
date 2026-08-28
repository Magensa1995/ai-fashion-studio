// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  buildLoginRedirect,
  requireUser,
  safeCallbackPath,
  UnauthorizedError,
} from "@/server/auth/session";

describe("requireUser", () => {
  it("returns the authenticated owner ID", async () => {
    await expect(
      requireUser(async () => ({
        expires: "2099-08-24T00:00:00.000Z",
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

  it("rejects a session whose expiry is no longer valid", async () => {
    await expect(
      requireUser(
        async () => ({
          expires: "2026-08-24T00:00:00.000Z",
          user: { id: "owner_123" },
        }),
        new Date("2026-08-27T00:00:00.000Z"),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it.each([
    [{ user: { id: "owner_123" } }],
    [{ expires: "not-a-date", user: { id: "owner_123" } }],
  ])(
    "rejects a session with missing or malformed expiry %o",
    async (session) => {
      await expect(
        requireUser(async () => session, new Date("2026-08-27T00:00:00.000Z")),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    },
  );

  it("is reusable by a private Route Handler-shaped entry point", async () => {
    async function GET() {
      const userId = await requireUser(async () => ({
        expires: "2099-08-24T00:00:00.000Z",
        user: { id: "owner_route" },
      }));

      return Response.json({ userId });
    }

    const response = await GET();

    await expect(response.json()).resolves.toEqual({ userId: "owner_route" });
  });

  it("is reusable by a private Server Action-shaped entry point", async () => {
    async function privateAction() {
      return requireUser(async () => null);
    }

    await expect(privateAction()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });
});

describe("safe callback destinations", () => {
  it.each([
    ["/", "/"],
    ["/?campaign=draft", "/?campaign=draft"],
    ["/studio?step=2#reference", "/studio?step=2#reference"],
  ])("preserves the same-origin path %s", (callbackUrl, expected) => {
    expect(safeCallbackPath(callbackUrl)).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "https://attacker.example/steal",
    "//attacker.example/steal",
    String.raw`\attacker.example\steal`,
    "javascript:alert(1)",
    "/login",
    "/login?callbackUrl=%2F",
  ])(
    "falls back to the dashboard root for unsafe callback %s",
    (callbackUrl) => {
      expect(safeCallbackPath(callbackUrl)).toBe("/");
    },
  );

  it("builds a login redirect from only the normalized same-origin path", () => {
    expect(buildLoginRedirect("/?campaign=draft")).toBe(
      "/login?callbackUrl=%2F%3Fcampaign%3Ddraft",
    );
    expect(buildLoginRedirect("https://attacker.example/steal")).toBe(
      "/login?callbackUrl=%2F",
    );
  });
});
