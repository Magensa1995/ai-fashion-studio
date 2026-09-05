import type {
  PreparedUpload,
  StorageObjectKey,
  ValidatedImageUpload,
} from "@/server/storage/keys";
import type { ObjectStorage } from "@/server/storage/types";

type Assert<Value extends true> = Value;
type AssertFalse<Value extends false> = Value;
type Extends<Actual, Expected> = Actual extends Expected ? true : false;

type RawValidatedUpload = {
  extension: "jpg";
  mimeType: "image/jpeg";
  sizeBytes: number;
};
type RawPreparedUpload = {
  key: StorageObjectKey;
  upload: RawValidatedUpload;
};

type _StorageKeyExtendsString = Assert<Extends<StorageObjectKey, string>>;
type _PlainStringDoesNotExtendStorageKey = AssertFalse<
  Extends<string, StorageObjectKey>
>;
type _RawValidatedUploadIsRejected = AssertFalse<
  Extends<RawValidatedUpload, ValidatedImageUpload>
>;
type _RawPreparedUploadIsRejected = AssertFalse<
  Extends<RawPreparedUpload, PreparedUpload>
>;
type _RawStringIsRejectedByHead = AssertFalse<
  Extends<string, Parameters<ObjectStorage["headObject"]>[0]>
>;
type _RawStringIsRejectedBySignedRead = AssertFalse<
  Extends<{ key: string }, Parameters<ObjectStorage["createSignedRead"]>[0]>
>;
type _RawStringIsRejectedByDelete = AssertFalse<
  Extends<{ key: string }, Parameters<ObjectStorage["deleteObject"]>[0]>
>;
type _RawStringIsRejectedByUploadIntent = AssertFalse<
  Extends<RawPreparedUpload, Parameters<ObjectStorage["createUploadIntent"]>[0]>
>;
type _RawStringIsRejectedByVerify = AssertFalse<
  Extends<RawPreparedUpload, Parameters<ObjectStorage["verifyUpload"]>[0]>
>;

export type StorageContractBrandAssertions = [
  _StorageKeyExtendsString,
  _PlainStringDoesNotExtendStorageKey,
  _RawValidatedUploadIsRejected,
  _RawPreparedUploadIsRejected,
  _RawStringIsRejectedByHead,
  _RawStringIsRejectedBySignedRead,
  _RawStringIsRejectedByDelete,
  _RawStringIsRejectedByUploadIntent,
  _RawStringIsRejectedByVerify,
];
