/*
  Warnings:

  - A unique constraint covering the columns `[portfolioSlug]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "portfolioAvatar" TEXT,
ADD COLUMN     "portfolioBio" TEXT,
ADD COLUMN     "portfolioLocation" TEXT,
ADD COLUMN     "portfolioSlug" TEXT,
ADD COLUMN     "portfolioTitle" TEXT,
ADD COLUMN     "twitterUrl" TEXT;

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "imageUrl" TEXT,
    "images" JSONB,
    "projectDate" TIMESTAMP(3) NOT NULL,
    "client" TEXT,
    "technologies" JSONB,
    "liveUrl" TEXT,
    "githubUrl" TEXT,
    "caseStudy" TEXT,
    "testimonial" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_slug_key" ON "Portfolio"("slug");

-- CreateIndex
CREATE INDEX "Portfolio_userId_deletedAt_idx" ON "Portfolio"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "Portfolio_slug_idx" ON "Portfolio"("slug");

-- CreateIndex
CREATE INDEX "Portfolio_userId_isPublished_deletedAt_idx" ON "Portfolio"("userId", "isPublished", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_portfolioSlug_key" ON "users"("portfolioSlug");

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
