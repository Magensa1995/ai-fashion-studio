// @vitest-environment node

import { describe, expect, it } from "vitest";

import { describeObjectStorageContract } from "@/server/storage/contract-tests";
import {
  createFakeObjectStorage,
  type FakeStorageFault,
} from "@/server/storage/fake-adapter";
import { prepareUpload } from "@/server/storage/keys";

describeObjectStorageContract("in-memory fake", () => {
  const storage = createFakeObjectStorage();

  return {
    storage,
    putObject: (input) => storage.putObject(input),
  };
});

describe("in-memory fake storage faults", () => {
  it("keeps mutable objects isolated to the factory instance that inserted them", async () => {
    const first = createFakeObjectStorage();
    const second = createFakeObjectStorage();
    const prepared = prepareUpload({
      ownerId: "owner_isolated",
      mediaId: "media_isolated",
      upload: { mimeType: "image/png", sizeBytes: 2 },
    });

    await first.putObject({
      contentLength: 2,
      contentType: "image/png",
      key: prepared.key,
    });

    await expect(first.headObject(prepared.key)).resolves.toMatchObject({
      contentLength: 2,
    });
    await expect(second.headObject(prepared.key)).resolves.toBeNull();
  });

  it("injects a retryable timeout for the selected operation", async () => {
    const faults: readonly FakeStorageFault[] = [
      { kind: "timeout", operation: "headObject" },
    ];
    const storage = createFakeObjectStorage({ faults });
    const prepared = prepareUpload({
      ownerId: "owner_timeout",
      mediaId: "media_timeout",
      upload: { mimeType: "image/png", sizeBytes: 2 },
    });

    await expect(storage.headObject(prepared.key)).rejects.toMatchObject({
      code: "TEMPORARY",
      retryable: true,
    });
  });

  it("forces a configured object to appear missing after insertion", async () => {
    const prepared = prepareUpload({
      ownerId: "owner_forced_missing",
      mediaId: "media_forced_missing",
      upload: { mimeType: "image/png", sizeBytes: 2 },
    });
    const storage = createFakeObjectStorage({
      faults: [{ key: prepared.key, kind: "missing-object" }],
    });

    await storage.putObject({
      contentLength: 2,
      contentType: "image/png",
      key: prepared.key,
    });

    await expect(storage.headObject(prepared.key)).resolves.toBeNull();
    await expect(storage.verifyUpload(prepared)).rejects.toMatchObject({
      code: "NOT_FOUND",
      retryable: false,
    });
  });

  it.each([{ contentLength: 5 }, { contentType: "image/png" }] as const)(
    "injects mismatched metadata that fails prepared upload verification: %o",
    async (mismatch) => {
      const prepared = prepareUpload({
        ownerId: "owner_mismatch",
        mediaId: "media_mismatch",
        upload: { mimeType: "image/jpeg", sizeBytes: 4 },
      });
      const storage = createFakeObjectStorage({
        faults: [
          {
            key: prepared.key,
            kind: "metadata-mismatch",
            ...mismatch,
          },
        ],
      });

      await storage.putObject({
        contentLength: 4,
        contentType: "image/jpeg",
        key: prepared.key,
      });

      await expect(storage.verifyUpload(prepared)).rejects.toMatchObject({
        code: "CONFLICT",
        retryable: false,
      });
    },
  );

  it("propagates an injected delete failure and retains the object", async () => {
    const prepared = prepareUpload({
      ownerId: "owner_delete_failure",
      mediaId: "media_delete_failure",
      upload: { mimeType: "image/webp", sizeBytes: 3 },
    });
    const storage = createFakeObjectStorage({
      faults: [{ key: prepared.key, kind: "delete-failure" }],
    });

    await storage.putObject({
      contentLength: 3,
      contentType: "image/webp",
      key: prepared.key,
    });

    await expect(
      storage.deleteObject({ key: prepared.key }),
    ).rejects.toMatchObject({ code: "UNAVAILABLE", retryable: true });
    await expect(storage.headObject(prepared.key)).resolves.toMatchObject({
      contentLength: 3,
    });
  });
});
