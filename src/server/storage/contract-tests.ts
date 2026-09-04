// @vitest-environment node

import { describe, expect, it } from "vitest";

import { StorageError } from "@/server/storage/errors";
import { prepareUpload } from "@/server/storage/keys";
import type { ObjectStorage, StoredObjectHead } from "@/server/storage/types";

export type StorageContractFixture = {
  putObject(input: StoredObjectHead): Promise<void>;
  storage: ObjectStorage;
};

export type CreateStorageContractFixture = () => StorageContractFixture;

export function describeObjectStorageContract(
  name: string,
  createFixture: CreateStorageContractFixture,
): void {
  describe(`${name} object storage contract`, () => {
    it("creates a usable PUT upload intent from server-prepared metadata", async () => {
      const { storage } = createFixture();
      const prepared = prepareUpload({
        ownerId: "owner_contract",
        mediaId: "intent_contract",
        upload: { mimeType: "image/png", sizeBytes: 4 },
      });

      const intent = await storage.createUploadIntent(prepared);

      expect(intent).toMatchObject({
        method: "PUT",
        requiredHeaders: expect.any(Object),
        url: expect.any(String),
      });
      expect(intent.url).not.toBe("");
      expect(intent.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("heads and verifies an inserted object using canonical MIME comparison", async () => {
      const fixture = createFixture();
      const prepared = prepareUpload({
        ownerId: "owner_contract",
        mediaId: "head_contract",
        upload: { mimeType: "image/png", sizeBytes: 4 },
      });
      const inserted = {
        contentLength: 4,
        contentType: " IMAGE/PNG ",
        etag: "etag-contract",
        key: prepared.key,
      };

      await fixture.putObject(inserted);

      await expect(fixture.storage.headObject(prepared.key)).resolves.toEqual(
        inserted,
      );
      await expect(fixture.storage.verifyUpload(prepared)).resolves.toEqual(
        inserted,
      );
    });

    it("creates a signed read for an inserted object", async () => {
      const fixture = createFixture();
      const prepared = prepareUpload({
        ownerId: "owner_contract",
        mediaId: "read_contract",
        upload: { mimeType: "image/webp", sizeBytes: 8 },
      });

      await fixture.putObject({
        contentLength: 8,
        contentType: "image/webp",
        key: prepared.key,
      });

      const signedRead = await fixture.storage.createSignedRead({
        key: prepared.key,
      });

      expect(signedRead.url).not.toBe("");
      expect(signedRead.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("deletes existing objects and treats repeated deletion as success", async () => {
      const fixture = createFixture();
      const prepared = prepareUpload({
        ownerId: "owner_contract",
        mediaId: "delete_contract",
        upload: { mimeType: "image/jpeg", sizeBytes: 1 },
      });

      await fixture.putObject({
        contentLength: 1,
        contentType: "image/jpeg",
        key: prepared.key,
      });

      await expect(
        fixture.storage.deleteObject({ key: prepared.key }),
      ).resolves.toBeUndefined();
      await expect(
        fixture.storage.headObject(prepared.key),
      ).resolves.toBeNull();
      await expect(
        fixture.storage.deleteObject({ key: prepared.key }),
      ).resolves.toBeUndefined();
    });

    it("returns null or NOT_FOUND for an object that is absent", async () => {
      const { storage } = createFixture();
      const prepared = prepareUpload({
        ownerId: "owner_contract",
        mediaId: "missing_contract",
        upload: { mimeType: "image/jpeg", sizeBytes: 1 },
      });

      await expect(storage.headObject(prepared.key)).resolves.toBeNull();
      await expect(storage.verifyUpload(prepared)).rejects.toMatchObject({
        code: "NOT_FOUND",
        retryable: false,
      } satisfies Partial<StorageError>);
      await expect(
        storage.createSignedRead({ key: prepared.key }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        retryable: false,
      } satisfies Partial<StorageError>);
    });
  });
}
