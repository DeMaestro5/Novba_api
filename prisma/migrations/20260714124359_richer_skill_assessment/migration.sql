-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUALS', 'STARTUPS', 'ENTERPRISE', 'AGENCIES');

-- CreateEnum
CREATE TYPE "NegotiationPosture" AS ENUM ('NEED_EVERY_JOB', 'SELECTIVE', 'CAN_DECLINE');

-- CreateEnum
CREATE TYPE "ProjectValueRange" AS ENUM ('UNDER_500', 'FROM_500_TO_2K', 'FROM_2K_TO_5K', 'FROM_5K_TO_15K', 'OVER_15K');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "averageProjectValue" "ProjectValueRange",
ADD COLUMN     "biggestChallenge" TEXT,
ADD COLUMN     "clientMarket" TEXT,
ADD COLUMN     "clientTypes" "ClientType"[] DEFAULT ARRAY[]::"ClientType"[],
ADD COLUMN     "negotiationPosture" "NegotiationPosture",
ADD COLUMN     "toolsAndSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "yearsOfExperience" INTEGER;
