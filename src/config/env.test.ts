import { describe, expect, it } from "vitest";

import { parseOwnerBootstrapEnv, parseServerEnv } from "@/config/env";

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

  it("accepts only explicit boolean values for the Auth.js host trust setting", () => {
    expect(parseServerEnv({ AUTH_TRUST_HOST: "true" }).AUTH_TRUST_HOST).toBe(
      true,
    );
    expect(parseServerEnv({ AUTH_TRUST_HOST: "false" }).AUTH_TRUST_HOST).toBe(
      false,
    );
    expect(() => parseServerEnv({ AUTH_TRUST_HOST: "yes" })).toThrow();
  });

  it("requires valid owner bootstrap credentials", () => {
    expect(
      parseOwnerBootstrapEnv({
        OWNER_EMAIL: "owner@example.com",
        OWNER_PASSWORD: "owner-passphrase-2026",
      }),
    ).toEqual({
      OWNER_EMAIL: "owner@example.com",
      OWNER_PASSWORD: "owner-passphrase-2026",
    });

    expect(() =>
      parseOwnerBootstrapEnv({
        OWNER_EMAIL: "not-an-email",
        OWNER_PASSWORD: "",
      }),
    ).toThrow();
  });
});
