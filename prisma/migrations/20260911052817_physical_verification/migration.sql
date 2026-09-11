-- CreateEnum
CREATE TYPE "PhysicalVerificationStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'PHYSICAL_VERIFICATION';

-- CreateTable
CREATE TABLE "PhysicalVerification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "verificationNumber" TEXT,
    "verificationDate" DATE NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "PhysicalVerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "narration" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalVerificationItem" (
    "id" TEXT NOT NULL,
    "physicalVerificationId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "systemQuantity" DECIMAL(14,4) NOT NULL,
    "countedQuantity" DECIMAL(14,4) NOT NULL,
    "varianceQuantity" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "PhysicalVerificationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhysicalVerification_companyId_status_idx" ON "PhysicalVerification"("companyId", "status");

-- CreateIndex
CREATE INDEX "PhysicalVerification_warehouseId_idx" ON "PhysicalVerification"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalVerification_companyId_financialYearId_verification_key" ON "PhysicalVerification"("companyId", "financialYearId", "verificationNumber");

-- CreateIndex
CREATE INDEX "PhysicalVerificationItem_productId_idx" ON "PhysicalVerificationItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalVerificationItem_physicalVerificationId_lineNumber_key" ON "PhysicalVerificationItem"("physicalVerificationId", "lineNumber");

-- AddForeignKey
ALTER TABLE "PhysicalVerification" ADD CONSTRAINT "PhysicalVerification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalVerification" ADD CONSTRAINT "PhysicalVerification_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalVerification" ADD CONSTRAINT "PhysicalVerification_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalVerification" ADD CONSTRAINT "PhysicalVerification_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalVerificationItem" ADD CONSTRAINT "PhysicalVerificationItem_physicalVerificationId_fkey" FOREIGN KEY ("physicalVerificationId") REFERENCES "PhysicalVerification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalVerificationItem" ADD CONSTRAINT "PhysicalVerificationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
