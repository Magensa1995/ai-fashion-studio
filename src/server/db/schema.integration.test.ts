// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  GenerationStatus,
  GenerationType,
  MediaKind,
  MediaStatus,
} from "@/generated/prisma/client";
import {
  createTestDatabaseClient,
  getTestDatabaseUrl,
} from "@/server/db/test-client";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const databaseSuite = describe.skipIf(!hasTestDatabase);

databaseSuite("V1 database relation graph", () => {
  let database: ReturnType<typeof createTestDatabaseClient>;

  beforeAll(() => {
    getTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    database = createTestDatabaseClient();
  });

  beforeEach(async () => {
    await database.$transaction([
      database.postMedia.deleteMany(),
      database.post.deleteMany(),
      database.generatedImage.deleteMany(),
      database.generation.deleteMany(),
      database.generationPreset.deleteMany(),
      database.productImage.deleteMany(),
      database.modelImage.deleteMany(),
      database.product.deleteMany(),
      database.modelProfile.deleteMany(),
      database.media.deleteMany(),
      database.user.deleteMany(),
    ]);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("persists the complete owner-scoped relation graph and restricts referenced media deletion", async () => {
    const user = await database.user.create({
      data: {
        email: "owner@example.com",
        passwordHash: "not-a-real-password-hash",
      },
    });

    const [productMedia, modelMedia, generatedMedia] = await Promise.all(
      [
        [MediaKind.PRODUCT, "products/front.webp"],
        [MediaKind.MODEL, "models/reference.webp"],
        [MediaKind.GENERATED, "generations/result.webp"],
      ].map(([kind, storageKey]) =>
        database.media.create({
          data: {
            userId: user.id,
            kind: kind as MediaKind,
            status: MediaStatus.READY,
            storageKey,
            originalFilename: storageKey.split("/").at(-1) ?? "image.webp",
            mimeType: "image/webp",
            sizeBytes: 1024,
          },
        }),
      ),
    );

    const product = await database.product.create({
      data: {
        userId: user.id,
        name: "Linen shirt",
        slug: "linen-shirt",
        images: { create: { mediaId: productMedia.id, type: "FRONT" } },
      },
    });
    const model = await database.modelProfile.create({
      data: {
        userId: user.id,
        name: "Studio model",
        images: { create: { mediaId: modelMedia.id } },
      },
    });
    const preset = await database.generationPreset.create({
      data: {
        userId: user.id,
        name: "Editorial daylight",
        type: GenerationType.VIRTUAL_TRY_ON,
        settings: { lighting: "daylight" },
      },
    });
    const generation = await database.generation.create({
      data: {
        userId: user.id,
        type: GenerationType.VIRTUAL_TRY_ON,
        status: GenerationStatus.COMPLETED,
        productId: product.id,
        modelProfileId: model.id,
        presetId: preset.id,
        promptData: { scene: "studio" },
        provider: "fake",
        providerModel: "fake-image-v1",
        aspectRatio: "4:5",
        imageCount: 1,
        generatedImages: {
          create: { mediaId: generatedMedia.id, sortOrder: 0 },
        },
      },
    });
    await database.post.create({
      data: {
        userId: user.id,
        title: "Linen editorial",
        slug: "linen-editorial",
        content: "Draft copy",
        coverMediaId: generatedMedia.id,
        sourceGenerationId: generation.id,
        media: { create: { mediaId: generatedMedia.id } },
      },
    });

    const graph = await database.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        products: { include: { images: true } },
        modelProfiles: { include: { images: true } },
        generations: { include: { generatedImages: true } },
        generationPresets: true,
        posts: { include: { media: true } },
      },
    });

    expect(graph.products[0]?.images).toHaveLength(1);
    expect(graph.modelProfiles[0]?.images).toHaveLength(1);
    expect(graph.generations[0]?.generatedImages).toHaveLength(1);
    expect(graph.generationPresets).toHaveLength(1);
    expect(graph.posts[0]?.media).toHaveLength(1);

    await expect(
      database.media.delete({ where: { id: generatedMedia.id } }),
    ).rejects.toMatchObject({
      code: "P2003",
    });
  });
});
