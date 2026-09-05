import { describe, expect, it } from "vitest";

import { normalizeEmail } from "@/server/auth/email";

describe("normalizeEmail", () => {
  it("trims surrounding whitespace and lowercases an owner email", () => {
    expect(normalizeEmail("  Owner@Example.COM ")).toBe("owner@example.com");
  });
});
