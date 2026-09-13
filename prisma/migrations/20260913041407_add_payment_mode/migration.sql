-- CreateEnum
CREATE TYPE "PaymentModeLedgerClass" AS ENUM ('CASH', 'BANK', 'ANY');

-- CreateTable
CREATE TABLE "PaymentMode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ledgerClass" "PaymentModeLedgerClass" NOT NULL,
    "isSystemDefined" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentMode_companyId_idx" ON "PaymentMode"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMode_companyId_name_key" ON "PaymentMode"("companyId", "name");

-- AddForeignKey
ALTER TABLE "PaymentMode" ADD CONSTRAINT "PaymentMode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
