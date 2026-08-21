import { describe, expect, it } from "vitest";

import { parseServerEnv } from "@/config/env";

describe("parseServerEnv", () => {
  it("rejects server secrets exposed through NEXT_PUBLIC variables", () => {
    expect(() =>
      parseServerEnv({
        NEXT_PUBLIC_OPENAI_API_KEY: "secret-value",
      }),
    ).toThrow(/NEXT_PUBLIC_OPENAI_API_KEY/);
  });

  it("normalizes an empty optional setting to undefined", () => {
    expect(
      parseServerEnv({ OPENAI_API_KEY: "" }).OPENAI_API_KEY,
    ).toBeUndefined();
  });
});
