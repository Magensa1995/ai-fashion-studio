import "server-only";

import { StorageError } from "@/server/storage/errors";
import {
  canonicalizeMimeType,
  type StorageObjectKey,
} from "@/server/storage/keys";
import type {
  CreateSignedReadInput,
  DeleteObjectInput,
  ObjectStorage,
  StoredObjectHead,
  UploadIntent,
  VerifyUploadInput,
} from "@/server/storage/types";

export type FakeStorageOperation =
  | "createUploadIntent"
  | "createSignedRead"
  | "deleteObject"
  | "headObject"
  | "verifyUpload";

type FakeMetadataMismatchFault =
  | {
      contentLength: number;
      contentType?: string;
      key: StorageObjectKey;
      kind: "metadata-mismatch";
    }
  | {
      contentLength?: number;
      contentType: string;
      key: StorageObjectKey;
      kind: "metadata-mismatch";
    };

export type FakeStorageFault =
  | { key: StorageObjectKey; kind: "delete-failure" }
  | { key: StorageObjectKey; kind: "missing-object" }
  | FakeMetadataMismatchFault
  | { kind: "timeout"; operation: FakeStorageOperation };

export type CreateFakeObjectStorageOptions = {
  faults?: readonly FakeStorageFault[];
};

/** Test-only object storage with fully isolated, deterministic in-memory state. */
export type FakeObjectStorage = ObjectStorage & {
  putObject(input: StoredObjectHead): Promise<void>;
};

const EXPIRY_MILLISECONDS = 15 * 60 * 1000;

export function createFakeObjectStorage(
  options: CreateFakeObjectStorageOptions = {},
): FakeObjectStorage {
  const faults = options.faults ?? [];
  const objects = new Map<StorageObjectKey, StoredObjectHead>();

  function getTimeout(
    operation: FakeStorageOperation,
  ): FakeStorageFault | undefined {
    return faults.find(
      (fault) => fault.kind === "timeout" && fault.operation === operation,
    );
  }

  function assertNotTimedOut(operation: FakeStorageOperation): void {
    if (getTimeout(operation)) {
      throw new StorageError(
        "TEMPORARY",
        `Fake storage timed out during ${operation}.`,
      );
    }
  }

  function isForcedMissing(key: StorageObjectKey): boolean {
    return faults.some(
      (fault) => fault.kind === "missing-object" && fault.key === key,
    );
  }

  function findObject(key: StorageObjectKey): StoredObjectHead | null {
    if (isForcedMissing(key)) {
      return null;
    }

    return objects.get(key) ?? null;
  }

  function notFound(key: StorageObjectKey): StorageError {
    return new StorageError(
      "NOT_FOUND",
      `Fake storage object was not found: ${key}`,
    );
  }

  function expiresAt(): Date {
    return new Date(Date.now() + EXPIRY_MILLISECONDS);
  }

  function fakeUrl(
    operation: "read" | "upload",
    key: StorageObjectKey,
  ): string {
    return `fake-storage://${operation}/${encodeURIComponent(key)}`;
  }

  return {
    async createUploadIntent(input): Promise<UploadIntent> {
      assertNotTimedOut("createUploadIntent");

      return {
        expiresAt: expiresAt(),
        method: "PUT",
        requiredHeaders: {
          "content-length": String(input.upload.sizeBytes),
          "content-type": input.upload.mimeType,
        },
        url: fakeUrl("upload", input.key),
      };
    },

    async createSignedRead(input: CreateSignedReadInput) {
      assertNotTimedOut("createSignedRead");

      if (!findObject(input.key)) {
        throw notFound(input.key);
      }

      return {
        expiresAt: expiresAt(),
        url: fakeUrl("read", input.key),
      };
    },

    async deleteObject(input: DeleteObjectInput): Promise<void> {
      assertNotTimedOut("deleteObject");

      if (
        faults.some(
          (fault) => fault.kind === "delete-failure" && fault.key === input.key,
        )
      ) {
        throw new StorageError(
          "UNAVAILABLE",
          `Fake storage delete failed for: ${input.key}`,
        );
      }

      objects.delete(input.key);
    },

    async headObject(key: StorageObjectKey): Promise<StoredObjectHead | null> {
      assertNotTimedOut("headObject");
      return findObject(key);
    },

    async putObject(input: StoredObjectHead): Promise<void> {
      const mismatch = faults.find(
        (fault): fault is FakeMetadataMismatchFault =>
          fault.kind === "metadata-mismatch" && fault.key === input.key,
      );

      objects.set(input.key, {
        ...input,
        ...(mismatch?.contentLength === undefined
          ? {}
          : { contentLength: mismatch.contentLength }),
        ...(mismatch?.contentType === undefined
          ? {}
          : { contentType: mismatch.contentType }),
      });
    },

    async verifyUpload(input: VerifyUploadInput): Promise<StoredObjectHead> {
      assertNotTimedOut("verifyUpload");
      const object = findObject(input.key);

      if (!object) {
        throw notFound(input.key);
      }

      if (
        object.contentLength !== input.upload.sizeBytes ||
        canonicalizeMimeType(object.contentType) !== input.upload.mimeType
      ) {
        throw new StorageError(
          "CONFLICT",
          `Fake storage metadata did not match prepared upload: ${input.key}`,
        );
      }

      return object;
    },
  };
}
