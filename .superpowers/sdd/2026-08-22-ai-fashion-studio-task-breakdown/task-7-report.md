# Task 7 — Storage contract and object-key policy report

## Delivered

- Added a server-only, provider-neutral `ObjectStorage` contract with upload-intent, head, verify, signed-read, and idempotent-delete operations.
- Added normalized `StorageError` codes with an explicit retryability mapping. Provider adapters must preserve this normalization.
- Added a V1 image policy: JPEG, PNG, and WebP only, with a default 20 MiB (`20 * 1024 * 1024`) maximum.
- Added a branded internal storage-key type. `buildMediaObjectKey` accepts only safe, trusted owner/media IDs plus validated upload policy; it does not accept filenames or client-supplied keys.
- Did not add any provider adapter, R2/AWS SDK import, client credential, Prisma schema change, or Task 8+ behavior.

## Test-first evidence

1. `src/server/storage/keys.test.ts` was added before `keys.ts` and failed with `Cannot find package '@/server/storage/keys'`.
2. After the key policy implementation, it passed: 47 tests.
3. `src/server/storage/errors.test.ts` was added while `errors.ts` was absent and failed with `Cannot find package '@/server/storage/errors'`.
4. After the normalized-error implementation, it passed: 9 tests.
5. The TypeScript contract assertion was introduced before `types.ts`; `pnpm typecheck` failed with `Cannot find module '@/server/storage/types'`. The final implementation passes the exact contract assertion without implementing a fake adapter.

The final exact focused storage run passed 75 tests, including table/property-style coverage for traversal-like and Unicode filenames, invalid MIME values (including inherited JavaScript property names), exact size boundaries, malformed/negative/non-finite sizes, unsafe identifier path segments, and mutable upload candidates.

## Verification

- `pnpm format:check` — passed.
- `pnpm lint` — passed with zero warnings.
- `pnpm typecheck` — passed.
- Focused storage tests — 75 passed.
- `pnpm test:runtime` — production build passed; runtime test: 1 passed, 3 skipped.
- `pnpm test:e2e` — 4 passed, 8 skipped (database-dependent cases).
- `pnpm exec playwright test --list` — collected 12 tests in 4 files.
- `pnpm test` — 181 passed, 5 skipped (186 total).

## Review notes

- Object paths use fixed literals plus conservative single path-segment IDs. IDs containing slashes, backslashes, percent-encoded separators, whitespace, controls, dots, or Unicode are rejected.
- Original filenames are not part of the key-builder public input; test payloads containing hostile/unicode filenames generate the same trusted-ID-derived key.
- `StorageObjectKey` is branded, and all adapter operations taking a key require that internal type.
- Delete is documented as idempotent in the contract; Task 7 intentionally leaves behavior to future adapters.
- The MIME lookup uses an own-property check, so values such as `toString` cannot bypass the allowlist through `Object.prototype`.

## Fix round 1 — deterministic property coverage

- Added deterministic generated-input properties without adding a test dependency: 256 valid owner/media pairs produce fixed, five-segment, injective WebP keys; each generated hostile/Unicode filename leaves its key unchanged.
- Added 259 MIME candidates (the three allowed literal values plus 256 generated candidates) and 256 generated integer sizes spanning values below, within, and above the 20 MiB policy. Malformed, fractional, and non-finite sizes remain rejected.
- Initial execution of the new key property failed because this Vitest configuration has no `toHaveSize` matcher. Replacing that unsupported matcher with the equivalent real `Set.size` assertion made the generated properties pass. The existing storage implementation passed every intended generated behavior, so this review fix changes tests and report only; no production behavior change was needed.
- Exact focused command: `node node_modules\\vitest\\vitest.mjs run src/server/storage/keys.test.ts src/server/storage/errors.test.ts` — 2 files, 60 tests passed.
- Final fix-round verification: `format:check`, lint, and typecheck passed; `pnpm test` passed 166 with 5 skipped; `pnpm test:runtime` passed 1 with 3 skipped; `pnpm test:e2e` passed 4 with 8 skipped; and `playwright test --list` collected 12 tests in 4 files.

## Fix round 2 — opaque prepared uploads and operation semantics

- Added opaque `ValidatedImageUpload` and `PreparedUpload` brands. `prepareUpload` now binds a generated storage key to the exact canonical MIME, extension, and byte count that passed server validation. Upload-intent and verify operations consume this single prepared value, so type-safe callers cannot mix a key with different metadata or forge the validation result.
- Added runtime coverage that rejects non-string owner/media IDs before regex coercion, proves the prepared binding, and canonicalizes provider MIME metadata to trimmed lowercase.
- Added independent pure-type assertions: the branded key extends `string` while plain strings do not extend the key brand; raw strings cannot satisfy every key-taking operation/input; and unbranded validated/prepared shapes are rejected.
- Defined adapter-neutral semantics in the contract: verify and signed reads report absent objects as `NOT_FOUND`; verify reports metadata differences as `CONFLICT` after lowercase canonical MIME comparison; invalid policy/caller input is `INVALID_REQUEST`; and delete maps only `NOT_FOUND` to idempotent success.
- RED evidence: the focused key suite failed 10 assertions because `canonicalizeMimeType` and `prepareUpload` did not exist and numeric/boolean/null/undefined identifiers were coerced by `RegExp.test`; typecheck failed because the new branded exports were absent and raw validated/prepared shapes structurally satisfied the prior types.
- GREEN evidence: after the contract implementation, the exact focused command (`node node_modules\\vitest\\vitest.mjs run src/server/storage/keys.test.ts src/server/storage/errors.test.ts`) passed 2 files and 74 tests; typecheck passed.
- Final fix-round verification: format and lint passed; `pnpm test` passed 180 with 5 skipped; `pnpm test:runtime` passed 1 with 3 skipped; `pnpm test:e2e` passed 4 with 8 skipped; and `playwright test --list` collected 12 tests in 4 files.

## Fix round 3 — immutable validation snapshot

- Added a mutable getter regression: a candidate returns JPEG during its first validation pass and PNG on later reads. RED showed the prior implementation produced a `.png` key paired with PNG metadata despite the initial JPEG validation.
- `validateImageUpload` now snapshots `mimeType` and `sizeBytes` once before validation. Both `buildMediaObjectKey` and `prepareUpload` derive keys from that immutable validated result, so prepared keys and metadata cannot diverge when a candidate getter mutates.
- RED evidence: `keys.test.ts` failed with `expected ...media_456.jpg` but received `.png` and PNG metadata. GREEN evidence: the exact focused command (`node node_modules\\vitest\\vitest.mjs run src/server/storage/keys.test.ts src/server/storage/errors.test.ts`) passed 2 files and 75 tests; typecheck passed.
- Final verification: format and lint passed; `pnpm test` passed 181 with 5 skipped; `pnpm test:runtime` passed 1 with 3 skipped; `pnpm test:e2e` passed 4 with 8 skipped; and `playwright test --list` collected 12 tests in 4 files.
