// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_UPLOAD_BYTES,
  buildMediaObjectKey,
  canonicalizeMimeType,
  prepareUpload,
  StoragePolicyError,
  validateImageUpload,
} from "@/server/storage/keys";

describe("V1 image upload policy", () => {
  it.each([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ] as const)(
    "accepts %s and assigns a .%s extension",
    (mimeType, extension) => {
      expect(validateImageUpload({ mimeType, sizeBytes: 1 })).toEqual({
        extension,
        mimeType,
        sizeBytes: 1,
      });
    },
  );

  it.each([
    "",
    "image/gif",
    "image/svg+xml",
    "application/octet-stream",
    "IMAGE/JPEG",
    "image/jpeg; charset=binary",
    "toString",
  ])("rejects an unsupported MIME type: %s", (mimeType) => {
    expect(() => validateImageUpload({ mimeType, sizeBytes: 1 })).toThrow(
      StoragePolicyError,
    );
  });

  it("accepts the exact default 20 MiB boundary", () => {
    expect(
      validateImageUpload({
        mimeType: "image/jpeg",
        sizeBytes: DEFAULT_MAX_UPLOAD_BYTES,
      }),
    ).toMatchObject({ sizeBytes: 20 * 1024 * 1024 });
  });

  it("rejects one byte beyond the default 20 MiB boundary", () => {
    expect(() =>
      validateImageUpload({
        mimeType: "image/jpeg",
        sizeBytes: DEFAULT_MAX_UPLOAD_BYTES + 1,
      }),
    ).toThrow(StoragePolicyError);
  });

  it.each([
    -1,
    -0.1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    1.1,
    "1",
    null,
    undefined,
  ])("rejects malformed upload sizes: %o", (sizeBytes) => {
    expect(() =>
      validateImageUpload({ mimeType: "image/png", sizeBytes }),
    ).toThrow(StoragePolicyError);
  });

  it("canonicalizes stored MIME metadata to lowercase before comparison", () => {
    expect(canonicalizeMimeType(" IMAGE/JPEG ")).toBe("image/jpeg");
  });
});

describe("media object keys", () => {
  it("uses trusted owner and media IDs, never the supplied filename", () => {
    const uploadRequest = {
      ownerId: "owner_123",
      mediaId: "media_456",
      upload: { mimeType: "image/jpeg", sizeBytes: 1 },
      originalFilename: String.raw`..\\..\\private\\💣.png`,
    };
    const key = buildMediaObjectKey(uploadRequest);

    expect(key).toBe("v1/owners/owner_123/media/media_456.jpg");
  });

  it.each([
    String.raw`../../etc/passwd`,
    String.raw`..\\..\\windows\\system32`,
    "report/../../secret.png",
    "\0evil.jpg",
    "фото-тест.png",
    "💣.webp",
  ])(
    "produces the same key for hostile or Unicode filenames: %s",
    (originalFilename) => {
      const uploadRequest = {
        ownerId: "owner_123",
        mediaId: "media_456",
        upload: { mimeType: "image/png", sizeBytes: 1 },
        originalFilename,
      };

      expect(buildMediaObjectKey(uploadRequest)).toBe(
        "v1/owners/owner_123/media/media_456.png",
      );
    },
  );

  it.each([
    "",
    ".",
    "..",
    "owner/other",
    String.raw`owner\\other`,
    "owner%2Fother",
    "owner other",
    "владелец",
    "owner\u0000id",
    "owner\nnext",
  ])("rejects unsafe owner path segments: %s", (ownerId) => {
    expect(() =>
      buildMediaObjectKey({
        ownerId,
        mediaId: "media_456",
        upload: { mimeType: "image/webp", sizeBytes: 1 },
      }),
    ).toThrow(StoragePolicyError);
  });

  it.each([
    "",
    ".",
    "..",
    "media/other",
    String.raw`media\\other`,
    "media%2Fother",
    "media other",
    "メディア",
    "media\u0000id",
  ])("rejects unsafe media path segments: %s", (mediaId) => {
    expect(() =>
      buildMediaObjectKey({
        ownerId: "owner_123",
        mediaId,
        upload: { mimeType: "image/webp", sizeBytes: 1 },
      }),
    ).toThrow(StoragePolicyError);
  });

  it.each([123, true, null, undefined, {}, []])(
    "rejects a non-string owner ID: %o",
    (ownerId) => {
      expect(() =>
        buildMediaObjectKey({
          ownerId: ownerId as string,
          mediaId: "media_456",
          upload: { mimeType: "image/webp", sizeBytes: 1 },
        }),
      ).toThrow(StoragePolicyError);
    },
  );

  it.each([123, true, null, undefined, {}, []])(
    "rejects a non-string media ID: %o",
    (mediaId) => {
      expect(() =>
        buildMediaObjectKey({
          ownerId: "owner_123",
          mediaId: mediaId as string,
          upload: { mimeType: "image/webp", sizeBytes: 1 },
        }),
      ).toThrow(StoragePolicyError);
    },
  );

  it("binds the generated key to canonical validated upload metadata", () => {
    expect(
      prepareUpload({
        ownerId: "owner_123",
        mediaId: "media_456",
        upload: { mimeType: "image/jpeg", sizeBytes: 1 },
      }),
    ).toMatchObject({
      key: "v1/owners/owner_123/media/media_456.jpg",
      upload: { extension: "jpg", mimeType: "image/jpeg", sizeBytes: 1 },
    });
  });

  it("uses one validated upload snapshot for both the key and metadata", () => {
    let mimeTypeReads = 0;
    const mutableCandidate = {
      get mimeType() {
        mimeTypeReads += 1;
        return mimeTypeReads <= 2 ? "image/jpeg" : "image/png";
      },
      sizeBytes: 1,
    };

    const prepared = prepareUpload({
      ownerId: "owner_123",
      mediaId: "media_456",
      upload: mutableCandidate,
    });

    expect(prepared).toMatchObject({
      key: "v1/owners/owner_123/media/media_456.jpg",
      upload: { extension: "jpg", mimeType: "image/jpeg", sizeBytes: 1 },
    });
    expect(mimeTypeReads).toBe(1);
  });

  it("keeps IDs as single, collision-safe path segments", () => {
    for (const id of ["a", "owner_1", "owner-1", "A9_z-0"]) {
      const key = buildMediaObjectKey({
        ownerId: id,
        mediaId: `${id}Media`,
        upload: { mimeType: "image/png", sizeBytes: 1 },
      });

      expect(key.split("/")).toEqual([
        "v1",
        "owners",
        id,
        "media",
        `${id}Media.png`,
      ]);
    }
  });
});

describe("V1 storage policy generated properties", () => {
  it("generates structurally safe, injective keys that ignore arbitrary filenames", () => {
    const next = deterministicGenerator(0x5eed1234);
    const keys = new Set<string>();

    for (let index = 0; index < 256; index += 1) {
      const ownerId = `${validPathSegment(next, 24)}_${index}`;
      const mediaId = `${validPathSegment(next, 24)}-${index}`;
      const originalFilename = arbitraryFilename(next);
      const upload = { mimeType: "image/webp", sizeBytes: index };
      const uploadRequest = {
        ownerId,
        mediaId,
        originalFilename,
        upload,
      };
      const key = buildMediaObjectKey(uploadRequest);

      expect(key).toBe(`v1/owners/${ownerId}/media/${mediaId}.webp`);
      expect(key.split("/")).toEqual([
        "v1",
        "owners",
        ownerId,
        "media",
        `${mediaId}.webp`,
      ]);
      expect(key).not.toContain(originalFilename);
      keys.add(key);
    }

    expect(keys.size).toBe(256);
  });

  it("accepts exactly the three V1 MIME types across generated candidates", () => {
    const next = deterministicGenerator(0x713c0de);
    const candidates = ["image/jpeg", "image/png", "image/webp"];

    for (let index = 0; index < 256; index += 1) {
      candidates.push(arbitraryMimeType(next));
    }

    for (const mimeType of candidates) {
      const accepted = acceptsImageUpload({ mimeType, sizeBytes: 1 });
      expect(accepted).toBe(
        mimeType === "image/jpeg" ||
          mimeType === "image/png" ||
          mimeType === "image/webp",
      );
    }
  });

  it("accepts exactly the integer size range from zero through 20 MiB", () => {
    const next = deterministicGenerator(0x20b0000d);
    const generatedSizes = [0, DEFAULT_MAX_UPLOAD_BYTES];

    for (let index = 0; index < 256; index += 1) {
      generatedSizes.push(
        (next() % (DEFAULT_MAX_UPLOAD_BYTES * 3 + 1)) -
          DEFAULT_MAX_UPLOAD_BYTES,
      );
    }

    for (const sizeBytes of generatedSizes) {
      expect(acceptsImageUpload({ mimeType: "image/jpeg", sizeBytes })).toBe(
        sizeBytes >= 0 && sizeBytes <= DEFAULT_MAX_UPLOAD_BYTES,
      );
    }

    for (const sizeBytes of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -0.5,
      0.5,
      "1",
      null,
      undefined,
    ]) {
      expect(acceptsImageUpload({ mimeType: "image/jpeg", sizeBytes })).toBe(
        false,
      );
    }
  });
});

function deterministicGenerator(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };
}

function validPathSegment(next: () => number, length: number): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let value = "a";

  for (let index = 1; index < length; index += 1) {
    value += alphabet[next() % alphabet.length];
  }

  return value;
}

function arbitraryFilename(next: () => number): string {
  const fragments = [
    "../",
    "\\\\",
    String.fromCharCode(0),
    "фото",
    "💣",
    ".png",
    "%2F",
  ];
  let value = "";

  for (let index = 0; index < 8; index += 1) {
    value += fragments[next() % fragments.length];
  }

  return value;
}

function arbitraryMimeType(next: () => number): string {
  const fragments = [
    "image",
    "application",
    "jpeg",
    "png",
    "webp",
    "svg+xml",
    "toString",
    "/",
    ";",
    "-",
  ];
  let value = "";

  for (let index = 0; index < 5; index += 1) {
    value += fragments[next() % fragments.length];
  }

  return value;
}

function acceptsImageUpload(input: {
  mimeType: unknown;
  sizeBytes: unknown;
}): boolean {
  try {
    validateImageUpload(input);
    return true;
  } catch (error) {
    if (error instanceof StoragePolicyError) {
      return false;
    }

    throw error;
  }
}
