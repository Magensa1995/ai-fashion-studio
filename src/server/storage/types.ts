import "server-only";

import type { PreparedUpload, StorageObjectKey } from "@/server/storage/keys";

/** A provider-neutral intent for a client to upload one server-authorized object. */
export type UploadIntent = {
  expiresAt: Date;
  method: "PUT";
  requiredHeaders: Readonly<Record<string, string>>;
  url: string;
};

/** A prepared key and canonical metadata that cannot be assembled by callers. */
export type CreateUploadIntentInput = PreparedUpload;

export type StoredObjectHead = {
  contentLength: number;
  contentType: string;
  etag?: string;
  key: StorageObjectKey;
};

/** A prepared key and canonical metadata that cannot be assembled by callers. */
export type VerifyUploadInput = PreparedUpload;

export type SignedRead = {
  expiresAt: Date;
  url: string;
};

export type CreateSignedReadInput = {
  key: StorageObjectKey;
};

export type DeleteObjectInput = {
  key: StorageObjectKey;
};

/**
 * Application-facing object storage contract. Implementations normalize
 * provider failures to StorageError with these operation-specific semantics:
 *
 * - createUploadIntent rejects invalid caller/policy inputs as INVALID_REQUEST.
 * - headObject returns null for an absent object.
 * - verifyUpload rejects an absent object as NOT_FOUND and a size or canonical
 *   lowercase MIME mismatch as CONFLICT. Compare provider metadata with
 *   canonicalizeMimeType before comparing it to prepared upload metadata.
 * - createSignedRead rejects an absent object as NOT_FOUND.
 * - deleteObject is idempotent: translate NOT_FOUND to success, while
 *   propagating every other normalized error.
 */
export interface ObjectStorage {
  createUploadIntent(input: CreateUploadIntentInput): Promise<UploadIntent>;
  createSignedRead(input: CreateSignedReadInput): Promise<SignedRead>;
  deleteObject(input: DeleteObjectInput): Promise<void>;
  headObject(key: StorageObjectKey): Promise<StoredObjectHead | null>;
  verifyUpload(input: VerifyUploadInput): Promise<StoredObjectHead>;
}
