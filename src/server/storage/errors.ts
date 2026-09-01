export const storageErrorRetryability = {
  ACCESS_DENIED: false,
  CONFLICT: false,
  INVALID_REQUEST: false,
  NOT_FOUND: false,
  RATE_LIMITED: true,
  TEMPORARY: true,
  UNAVAILABLE: true,
} as const;

export type StorageErrorCode = keyof typeof storageErrorRetryability;

export class StorageError extends Error {
  readonly retryable: boolean;

  constructor(
    readonly code: StorageErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "StorageError";
    this.retryable = storageErrorRetryability[code];
  }
}

export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}
