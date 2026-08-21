-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('UPLOAD', 'PRODUCT', 'MODEL', 'GENERATED', 'POST');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('DRAFT', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductImageType" AS ENUM ('FRONT', 'BACK', 'DETAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "GenerationType" AS ENUM ('PRODUCT_TO_MODEL', 'VIRTUAL_TRY_ON', 'IMAGE_EDIT', 'BACKGROUND_REPLACE', 'VARIATION');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "type" "ProductImageType" NOT NULL DEFAULT 'OTHER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ModelProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelImage" (
    "id" TEXT NOT NULL,
    "modelProfileId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ModelImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'DRAFT',
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "GenerationType" NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "productId" TEXT,
    "modelProfileId" TEXT,
    "sourceMediaId" TEXT,
    "presetId" TEXT,
    "retryOfId" TEXT,
    "promptData" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "providerModel" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "imageCount" INTEGER NOT NULL DEFAULT 2,
    "providerRequestId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Generation_imageCount_check" CHECK ("imageCount" BETWEEN 1 AND 2)
);

-- CreateTable
CREATE TABLE "GeneratedImage" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GenerationType" NOT NULL,
    "settings" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "coverMediaId" TEXT,
    "sourceGenerationId" TEXT,
    "socialMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostMedia" (
    "postId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("postId","mediaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Product_userId_status_createdAt_idx" ON "Product"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_userId_slug_key" ON "Product"("userId", "slug");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_productId_mediaId_key" ON "ProductImage"("productId", "mediaId");

-- CreateIndex
CREATE INDEX "ModelProfile_userId_status_createdAt_idx" ON "ModelProfile"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ModelImage_modelProfileId_sortOrder_idx" ON "ModelImage"("modelProfileId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ModelImage_modelProfileId_mediaId_key" ON "ModelImage"("modelProfileId", "mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "Media_storageKey_key" ON "Media"("storageKey");

-- CreateIndex
CREATE INDEX "Media_userId_kind_status_createdAt_idx" ON "Media"("userId", "kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Media_userId_deletedAt_idx" ON "Media"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "Generation_userId_status_createdAt_idx" ON "Generation"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Generation_userId_type_createdAt_idx" ON "Generation"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Generation_productId_idx" ON "Generation"("productId");

-- CreateIndex
CREATE INDEX "Generation_modelProfileId_idx" ON "Generation"("modelProfileId");

-- CreateIndex
CREATE INDEX "Generation_sourceMediaId_idx" ON "Generation"("sourceMediaId");

-- CreateIndex
CREATE INDEX "Generation_retryOfId_idx" ON "Generation"("retryOfId");

-- CreateIndex
CREATE INDEX "GeneratedImage_generationId_isFavorite_idx" ON "GeneratedImage"("generationId", "isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedImage_generationId_sortOrder_key" ON "GeneratedImage"("generationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedImage_generationId_mediaId_key" ON "GeneratedImage"("generationId", "mediaId");

-- CreateIndex
CREATE INDEX "GenerationPreset_userId_type_isDefault_idx" ON "GenerationPreset"("userId", "type", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationPreset_userId_name_key" ON "GenerationPreset"("userId", "name");

-- CreateIndex
CREATE INDEX "Post_userId_status_createdAt_idx" ON "Post"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Post_coverMediaId_idx" ON "Post"("coverMediaId");

-- CreateIndex
CREATE INDEX "Post_sourceGenerationId_idx" ON "Post"("sourceGenerationId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_userId_slug_key" ON "Post"("userId", "slug");

-- CreateIndex
CREATE INDEX "PostMedia_postId_sortOrder_idx" ON "PostMedia"("postId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelProfile" ADD CONSTRAINT "ModelProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelImage" ADD CONSTRAINT "ModelImage_modelProfileId_fkey" FOREIGN KEY ("modelProfileId") REFERENCES "ModelProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelImage" ADD CONSTRAINT "ModelImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_modelProfileId_fkey" FOREIGN KEY ("modelProfileId") REFERENCES "ModelProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_sourceMediaId_fkey" FOREIGN KEY ("sourceMediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "GenerationPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_retryOfId_fkey" FOREIGN KEY ("retryOfId") REFERENCES "Generation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationPreset" ADD CONSTRAINT "GenerationPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_sourceGenerationId_fkey" FOREIGN KEY ("sourceGenerationId") REFERENCES "Generation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
