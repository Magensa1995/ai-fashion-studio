// @vitest-environment node

import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns a non-cacheable liveness response without environment details", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
