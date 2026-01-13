/*
  Warnings:

  - The values [BUSINESS] on the enum `SubscriptionTier` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "EmailStatus" ADD VALUE 'BOUNCED';

-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'WELCOME';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExpenseCategory" ADD VALUE 'INSURANCE';
ALTER TYPE "ExpenseCategory" ADD VALUE 'TAXES';

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'MOBILE_MONEY';
ALTER TYPE "PaymentMethod" ADD VALUE 'CRYPTO';

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'TRIALING';

-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionTier_new" AS ENUM ('FREE', 'PRO', 'STUDIO');
ALTER TABLE "users" ALTER COLUMN "subscriptionTier" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "subscriptionTier" TYPE "SubscriptionTier_new" USING ("subscriptionTier"::text::"SubscriptionTier_new");
ALTER TABLE "subscriptions" ALTER COLUMN "tier" TYPE "SubscriptionTier_new" USING ("tier"::text::"SubscriptionTier_new");
ALTER TYPE "SubscriptionTier" RENAME TO "SubscriptionTier_old";
ALTER TYPE "SubscriptionTier_new" RENAME TO "SubscriptionTier";
DROP TYPE "SubscriptionTier_old";
ALTER TABLE "users" ALTER COLUMN "subscriptionTier" SET DEFAULT 'FREE';
COMMIT;

-- DropIndex
DROP INDEX "invoices_dueDate_idx";

-- DropIndex
DROP INDEX "keystores_userId_primaryKey_secondaryKey_idx";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "averageHourlyRate" DECIMAL(10,2),
ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "invoices_status_dueDate_idx" ON "invoices"("status", "dueDate");

-- CreateIndex
CREATE INDEX "users_subscriptionTier_subscriptionStatus_idx" ON "users"("subscriptionTier", "subscriptionStatus");
