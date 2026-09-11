-- CreateEnum
CREATE TYPE "PurchaseReturnStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PurchaseReturn" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "returnNumber" TEXT,
    "returnDate" DATE NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "refundMode" "RefundMode" NOT NULL DEFAULT 'LEDGER_ADJUSTMENT',
    "refundLedgerId" TEXT,
    "status" "PurchaseReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
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

    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturnItem" (
    "id" TEXT NOT NULL,
    "purchaseReturnId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "purchaseInvoiceItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "taxableAmount" DECIMAL(14,2) NOT NULL,
    "cgst" DECIMAL(14,2) NOT NULL,
    "sgst" DECIMAL(14,2) NOT NULL,
    "igst" DECIMAL(14,2) NOT NULL,
    "cess" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PurchaseReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_voucherId_key" ON "PurchaseReturn"("voucherId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_companyId_purchaseInvoiceId_idx" ON "PurchaseReturn"("companyId", "purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_companyId_status_idx" ON "PurchaseReturn"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_companyId_financialYearId_returnNumber_key" ON "PurchaseReturn"("companyId", "financialYearId", "returnNumber");

-- CreateIndex
CREATE INDEX "PurchaseReturnItem_purchaseInvoiceItemId_idx" ON "PurchaseReturnItem"("purchaseInvoiceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturnItem_purchaseReturnId_lineNumber_key" ON "PurchaseReturnItem"("purchaseReturnId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturnItem_purchaseReturnId_purchaseInvoiceItemId_key" ON "PurchaseReturnItem"("purchaseReturnId", "purchaseInvoiceItemId");

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_refundLedgerId_fkey" FOREIGN KEY ("refundLedgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseInvoiceItemId_fkey" FOREIGN KEY ("purchaseInvoiceItemId") REFERENCES "PurchaseInvoiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
