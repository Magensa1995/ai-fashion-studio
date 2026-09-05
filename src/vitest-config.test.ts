// @vitest-environment node

import { describe, expect, it } from "vitest";

import config from "../vitest.config";

describe("Vitest database integration scheduling", () => {
  it("serializes test files because database integration suites share one test database", () => {
    const testConfig = config as { test?: { fileParallelism?: boolean } };

    expect(testConfig.test?.fileParallelism).toBe(false);
  });
});
