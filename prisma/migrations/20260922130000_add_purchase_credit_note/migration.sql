-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'PURCHASE_CREDIT_NOTE';
ALTER TYPE "DocumentType" ADD VALUE 'PURCHASE_CREDIT_NOTE_VOUCHER';

-- AlterEnum
ALTER TYPE "VoucherType" ADD VALUE 'PURCHASE_CREDIT_NOTE';

-- CreateTable
CREATE TABLE "PurchaseCreditNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "noteNumber" TEXT,
    "noteDate" DATE NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT,
    "placeOfSupplyStateCode" TEXT NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL,
    "taxableAmount" DECIMAL(14,2) NOT NULL,
    "totalCgst" DECIMAL(14,2) NOT NULL,
    "totalSgst" DECIMAL(14,2) NOT NULL,
    "totalIgst" DECIMAL(14,2) NOT NULL,
    "totalCess" DECIMAL(14,2) NOT NULL,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "voucherId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseCreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseCreditNoteItem" (
    "id" TEXT NOT NULL,
    "purchaseCreditNoteId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "taxableAmount" DECIMAL(14,2) NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "cessPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(14,2) NOT NULL,
    "sgst" DECIMAL(14,2) NOT NULL,
    "igst" DECIMAL(14,2) NOT NULL,
    "cess" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PurchaseCreditNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseCreditNote_voucherId_key" ON "PurchaseCreditNote"("voucherId");

-- CreateIndex
CREATE INDEX "PurchaseCreditNote_companyId_supplierId_idx" ON "PurchaseCreditNote"("companyId", "supplierId");

-- CreateIndex
CREATE INDEX "PurchaseCreditNote_companyId_status_idx" ON "PurchaseCreditNote"("companyId", "status");

-- CreateIndex
CREATE INDEX "PurchaseCreditNote_purchaseInvoiceId_idx" ON "PurchaseCreditNote"("purchaseInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseCreditNote_companyId_financialYearId_noteNumber_key" ON "PurchaseCreditNote"("companyId", "financialYearId", "noteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseCreditNoteItem_purchaseCreditNoteId_lineNumber_key" ON "PurchaseCreditNoteItem"("purchaseCreditNoteId", "lineNumber");

-- AddForeignKey
ALTER TABLE "PurchaseCreditNote" ADD CONSTRAINT "PurchaseCreditNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCreditNote" ADD CONSTRAINT "PurchaseCreditNote_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCreditNote" ADD CONSTRAINT "PurchaseCreditNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCreditNote" ADD CONSTRAINT "PurchaseCreditNote_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCreditNote" ADD CONSTRAINT "PurchaseCreditNote_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCreditNote" ADD CONSTRAINT "PurchaseCreditNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCreditNoteItem" ADD CONSTRAINT "PurchaseCreditNoteItem_purchaseCreditNoteId_fkey" FOREIGN KEY ("purchaseCreditNoteId") REFERENCES "PurchaseCreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

