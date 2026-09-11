
-- CreateEnum
CREATE TYPE "GstReturnType" AS ENUM ('GSTR1', 'GSTR3B');

-- CreateEnum
CREATE TYPE "GstFilingStatus" AS ENUM ('OPEN', 'FILED');

-- CreateEnum
CREATE TYPE "GstFilingFrequency" AS ENUM ('MONTHLY', 'QUARTERLY');

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "gstFilingFrequency" "GstFilingFrequency" NOT NULL DEFAULT 'MONTHLY';

-- CreateTable
CREATE TABLE "GstFilingRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "returnType" "GstReturnType" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "GstFilingStatus" NOT NULL DEFAULT 'OPEN',
    "arn" TEXT,
    "filedAt" TIMESTAMP(3),
    "filedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GstFilingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GstFilingRecord_companyId_returnType_idx" ON "GstFilingRecord"("companyId", "returnType");

-- CreateIndex
CREATE UNIQUE INDEX "GstFilingRecord_companyId_returnType_periodStart_periodEnd_key" ON "GstFilingRecord"("companyId", "returnType", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "GstFilingRecord" ADD CONSTRAINT "GstFilingRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstFilingRecord" ADD CONSTRAINT "GstFilingRecord_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstFilingRecord" ADD CONSTRAINT "GstFilingRecord_filedByUserId_fkey" FOREIGN KEY ("filedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

