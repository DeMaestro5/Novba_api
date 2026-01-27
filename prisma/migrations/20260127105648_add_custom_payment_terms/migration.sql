-- AlterEnum
ALTER TYPE "PaymentTerms" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "paymentTermsCustom" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "defaultPaymentTermsCustom" TEXT;
