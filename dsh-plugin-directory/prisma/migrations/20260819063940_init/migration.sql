-- CreateEnum
CREATE TYPE "PluginStatus" AS ENUM ('Draft', 'Scheduled', 'Published', 'Deleted');

-- CreateTable
CREATE TABLE "Plugin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "repositoryUrl" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "content" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "faviconUrl" TEXT,
    "screenshotUrl" TEXT,
    "screenshots" TEXT[],
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "PluginStatus" NOT NULL DEFAULT 'Published',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bundleCategory" TEXT,
    "bundleCategoryZh" TEXT,
    "taglineZh" TEXT,
    "sourceUrl" TEXT,
    "sourceRepo" TEXT,
    "yamlFile" TEXT,
    "importSource" TEXT,
    "npmPackage" TEXT,
    "tarballUrl" TEXT,
    "installCommand" TEXT,
    "categoryId" TEXT,

    CONSTRAINT "Plugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelZh" TEXT,
    "emoji" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plugin_slug_key" ON "Plugin"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Plugin_repositoryUrl_key" ON "Plugin"("repositoryUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Plugin_sourceUrl_key" ON "Plugin"("sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Plugin_yamlFile_key" ON "Plugin"("yamlFile");

-- CreateIndex
CREATE INDEX "Plugin_name_idx" ON "Plugin"("name");

-- CreateIndex
CREATE INDEX "Plugin_status_idx" ON "Plugin"("status");

-- CreateIndex
CREATE INDEX "Plugin_isFeatured_score_idx" ON "Plugin"("isFeatured", "score");

-- CreateIndex
CREATE INDEX "Plugin_bundleCategory_idx" ON "Plugin"("bundleCategory");

-- CreateIndex
CREATE INDEX "Plugin_importSource_idx" ON "Plugin"("importSource");

-- AddForeignKey
ALTER TABLE "Plugin" ADD CONSTRAINT "Plugin_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
