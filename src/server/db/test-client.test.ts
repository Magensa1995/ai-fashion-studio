import { describe, expect, it } from "vitest";

import { getTestDatabaseUrl } from "@/server/db/test-client";

describe("getTestDatabaseUrl", () => {
  it("requires an explicit test database connection string", () => {
    expect(() => getTestDatabaseUrl(undefined)).toThrow(
      /TEST_DATABASE_URL is required/,
    );
  });

  it("rejects a connection string that does not target a test database", () => {
    expect(() =>
      getTestDatabaseUrl("postgresql://studio:studio@localhost:5432/studio"),
    ).toThrow(/ends with _test/);
  });

  it("accepts a database name with the required test suffix", () => {
    const connectionString =
      "postgresql://studio:studio@localhost:5432/studio_test?schema=public";

    expect(getTestDatabaseUrl(connectionString)).toBe(connectionString);
  });
});
