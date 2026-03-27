-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lifetimeAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lifetimeAccessGrantedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "waitlist_emails" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_emails_email_key" ON "waitlist_emails"("email");
