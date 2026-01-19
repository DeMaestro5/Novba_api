-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'EXPIRED', 'TERMINATED');

-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'CONTRACT_SIGNED';

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "proposalId" TEXT,
    "contractNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "templateType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "terms" JSONB,
    "signedAt" TIMESTAMP(3),
    "signatureUrl" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contracts_proposalId_key" ON "contracts"("proposalId");

-- CreateIndex
CREATE INDEX "contracts_userId_idx" ON "contracts"("userId");

-- CreateIndex
CREATE INDEX "contracts_clientId_idx" ON "contracts"("clientId");

-- CreateIndex
CREATE INDEX "contracts_proposalId_idx" ON "contracts"("proposalId");

-- CreateIndex
CREATE INDEX "contracts_userId_status_idx" ON "contracts"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_userId_contractNumber_key" ON "contracts"("userId", "contractNumber");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
