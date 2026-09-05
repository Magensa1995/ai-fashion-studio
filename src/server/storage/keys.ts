import "server-only";

import { StorageError } from "@/server/storage/errors";

export const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const imageMimeExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ImageMimeType = keyof typeof imageMimeExtensions;
export type ImageFileExtension = (typeof imageMimeExtensions)[ImageMimeType];
export type StorageObjectKey = string & {
  readonly __storageObjectKey: unique symbol;
};

declare const validatedImageUploadBrand: unique symbol;

export type ValidatedImageUpload = {
  extension: ImageFileExtension;
  mimeType: ImageMimeType;
  sizeBytes: number;
  readonly [validatedImageUploadBrand]: true;
};

export type ImageUploadCandidate = {
  mimeType: unknown;
  sizeBytes: unknown;
};

export class StoragePolicyError extends StorageError {
  constructor(message: string) {
    super("INVALID_REQUEST", message);
    this.name = "StoragePolicyError";
  }
}

export function validateImageUpload(
  candidate: ImageUploadCandidate,
  maxBytes = DEFAULT_MAX_UPLOAD_BYTES,
): ValidatedImageUpload {
  const mimeType = candidate.mimeType;
  const sizeBytes = candidate.sizeBytes;

  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 0 ||
    typeof sizeBytes !== "number" ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 0 ||
    sizeBytes > maxBytes
  ) {
    throw new StoragePolicyError("Image size is invalid or exceeds the limit.");
  }

  if (!isImageMimeType(mimeType)) {
    throw new StoragePolicyError("Image MIME type is not allowed.");
  }

  return {
    extension: imageMimeExtensions[mimeType],
    mimeType,
    sizeBytes,
  } as ValidatedImageUpload;
}

export type BuildMediaObjectKeyInput = {
  ownerId: string;
  mediaId: string;
  upload: ImageUploadCandidate;
};

declare const preparedUploadBrand: unique symbol;

/** A server-prepared, opaque binding of a generated key to validated metadata. */
export type PreparedUpload = {
  key: StorageObjectKey;
  upload: ValidatedImageUpload;
  readonly [preparedUploadBrand]: true;
};

/**
 * Creates an internal key from server-trusted IDs and validated server policy.
 * A filename or client-supplied storage key is deliberately not accepted.
 */
export function buildMediaObjectKey({
  ownerId,
  mediaId,
  upload,
}: BuildMediaObjectKeyInput): StorageObjectKey {
  return buildMediaObjectKeyFromValidated(
    ownerId,
    mediaId,
    validateImageUpload(upload),
  );
}

function buildMediaObjectKeyFromValidated(
  ownerId: string,
  mediaId: string,
  upload: ValidatedImageUpload,
): StorageObjectKey {
  assertTrustedPathSegment("owner ID", ownerId);
  assertTrustedPathSegment("media ID", mediaId);

  return `v1/owners/${ownerId}/media/${mediaId}.${upload.extension}` as StorageObjectKey;
}

/**
 * Produces the only value accepted by upload-intent and verification
 * operations, keeping the generated key and canonical validated metadata
 * inseparable to type-safe callers.
 */
export function prepareUpload(input: BuildMediaObjectKeyInput): PreparedUpload {
  const upload = validateImageUpload(input.upload);

  return {
    key: buildMediaObjectKeyFromValidated(input.ownerId, input.mediaId, upload),
    upload,
  } as PreparedUpload;
}

/** Normalizes provider-reported MIME metadata for exact comparison. */
export function canonicalizeMimeType(value: string): string {
  return value.trim().toLowerCase();
}

function isImageMimeType(value: unknown): value is ImageMimeType {
  return typeof value === "string" && Object.hasOwn(imageMimeExtensions, value);
}

function assertTrustedPathSegment(label: string, value: unknown): void {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)
  ) {
    throw new StoragePolicyError(`${label} is not a safe path segment.`);
  }
}
