// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  isStorageError,
  StorageError,
  storageErrorRetryability,
} from "@/server/storage/errors";

describe("normalized storage errors", () => {
  it.each([
    ["ACCESS_DENIED", false],
    ["CONFLICT", false],
    ["INVALID_REQUEST", false],
    ["NOT_FOUND", false],
    ["RATE_LIMITED", true],
    ["TEMPORARY", true],
    ["UNAVAILABLE", true],
  ] as const)("marks %s failures as retryable=%s", (code, retryable) => {
    const error = new StorageError(code, "provider response");

    expect(error).toMatchObject({ code, retryable });
    expect(isStorageError(error)).toBe(true);
  });

  it("does not mistake an arbitrary error for a normalized storage error", () => {
    expect(isStorageError(new Error("provider response"))).toBe(false);
  });

  it("exposes the complete retryability mapping for provider adapters", () => {
    expect(storageErrorRetryability).toEqual({
      ACCESS_DENIED: false,
      CONFLICT: false,
      INVALID_REQUEST: false,
      NOT_FOUND: false,
      RATE_LIMITED: true,
      TEMPORARY: true,
      UNAVAILABLE: true,
    });
  });
});
