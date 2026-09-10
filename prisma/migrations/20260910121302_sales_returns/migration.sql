-- CreateEnum
CREATE TYPE "SalesReturnStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundMode" AS ENUM ('LEDGER_ADJUSTMENT', 'CASH_REFUND');

-- CreateTable
CREATE TABLE "SalesReturn" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "returnNumber" TEXT,
    "returnDate" DATE NOT NULL,
    "salesInvoiceId" TEXT NOT NULL,
    "refundMode" "RefundMode" NOT NULL DEFAULT 'LEDGER_ADJUSTMENT',
    "refundLedgerId" TEXT,
    "status" "SalesReturnStatus" NOT NULL DEFAULT 'DRAFT',
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

    CONSTRAINT "SalesReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesReturnItem" (
    "id" TEXT NOT NULL,
    "salesReturnId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "salesInvoiceItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "taxableAmount" DECIMAL(14,2) NOT NULL,
    "cgst" DECIMAL(14,2) NOT NULL,
    "sgst" DECIMAL(14,2) NOT NULL,
    "igst" DECIMAL(14,2) NOT NULL,
    "cess" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SalesReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturn_voucherId_key" ON "SalesReturn"("voucherId");

-- CreateIndex
CREATE INDEX "SalesReturn_companyId_salesInvoiceId_idx" ON "SalesReturn"("companyId", "salesInvoiceId");

-- CreateIndex
CREATE INDEX "SalesReturn_companyId_status_idx" ON "SalesReturn"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturn_companyId_financialYearId_returnNumber_key" ON "SalesReturn"("companyId", "financialYearId", "returnNumber");

-- CreateIndex
CREATE INDEX "SalesReturnItem_salesInvoiceItemId_idx" ON "SalesReturnItem"("salesInvoiceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturnItem_salesReturnId_lineNumber_key" ON "SalesReturnItem"("salesReturnId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturnItem_salesReturnId_salesInvoiceItemId_key" ON "SalesReturnItem"("salesReturnId", "salesInvoiceItemId");

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_refundLedgerId_fkey" FOREIGN KEY ("refundLedgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_salesReturnId_fkey" FOREIGN KEY ("salesReturnId") REFERENCES "SalesReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_salesInvoiceItemId_fkey" FOREIGN KEY ("salesInvoiceItemId") REFERENCES "SalesInvoiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
