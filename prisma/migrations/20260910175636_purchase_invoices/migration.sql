-- CreateEnum
CREATE TYPE "PurchaseInvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "inputCessLedgerId" TEXT,
ADD COLUMN     "inputCgstLedgerId" TEXT,
ADD COLUMN     "inputIgstLedgerId" TEXT,
ADD COLUMN     "inputSgstLedgerId" TEXT,
ADD COLUMN     "purchaseLedgerId" TEXT;

-- CreateTable
CREATE TABLE "PurchaseInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "supplierInvoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "supplierId" TEXT NOT NULL,
    "placeOfSupplyStateCode" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "goodsReceiptNoteId" TEXT,
    "status" "PurchaseInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "narration" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "totalDiscount" DECIMAL(14,2) NOT NULL,
    "taxableAmount" DECIMAL(14,2) NOT NULL,
    "totalCgst" DECIMAL(14,2) NOT NULL,
    "totalSgst" DECIMAL(14,2) NOT NULL,
    "totalIgst" DECIMAL(14,2) NOT NULL,
    "totalCess" DECIMAL(14,2) NOT NULL,
    "roundOff" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "voucherId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoiceItem" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "cessPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(14,2) NOT NULL,
    "cgst" DECIMAL(14,2) NOT NULL,
    "sgst" DECIMAL(14,2) NOT NULL,
    "igst" DECIMAL(14,2) NOT NULL,
    "cess" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "isTaxOverridden" BOOLEAN NOT NULL DEFAULT false,
    "overriddenCgst" DECIMAL(14,2),
    "overriddenSgst" DECIMAL(14,2),
    "overriddenIgst" DECIMAL(14,2),
    "overriddenCess" DECIMAL(14,2),
    "overrideReason" TEXT,
    "overriddenByUserId" TEXT,

    CONSTRAINT "PurchaseInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoicePayment" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,

    CONSTRAINT "PurchaseInvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_goodsReceiptNoteId_key" ON "PurchaseInvoice"("goodsReceiptNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_voucherId_key" ON "PurchaseInvoice"("voucherId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_companyId_status_idx" ON "PurchaseInvoice"("companyId", "status");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_purchaseOrderId_idx" ON "PurchaseInvoice"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_companyId_financialYearId_invoiceNumber_key" ON "PurchaseInvoice"("companyId", "financialYearId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_companyId_supplierId_supplierInvoiceNumber_key" ON "PurchaseInvoice"("companyId", "supplierId", "supplierInvoiceNumber");

-- CreateIndex
CREATE INDEX "PurchaseInvoiceItem_productId_idx" ON "PurchaseInvoiceItem"("productId");

-- CreateIndex
CREATE INDEX "PurchaseInvoiceItem_warehouseId_idx" ON "PurchaseInvoiceItem"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoiceItem_purchaseInvoiceId_lineNumber_key" ON "PurchaseInvoiceItem"("purchaseInvoiceId", "lineNumber");

-- CreateIndex
CREATE INDEX "PurchaseInvoicePayment_purchaseInvoiceId_idx" ON "PurchaseInvoicePayment"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "PurchaseInvoicePayment_ledgerId_idx" ON "PurchaseInvoicePayment"("ledgerId");

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_purchaseLedgerId_fkey" FOREIGN KEY ("purchaseLedgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_inputCgstLedgerId_fkey" FOREIGN KEY ("inputCgstLedgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_inputSgstLedgerId_fkey" FOREIGN KEY ("inputSgstLedgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_inputIgstLedgerId_fkey" FOREIGN KEY ("inputIgstLedgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_inputCessLedgerId_fkey" FOREIGN KEY ("inputCessLedgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_goodsReceiptNoteId_fkey" FOREIGN KEY ("goodsReceiptNoteId") REFERENCES "GoodsReceiptNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceItem" ADD CONSTRAINT "PurchaseInvoiceItem_overriddenByUserId_fkey" FOREIGN KEY ("overriddenByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoicePayment" ADD CONSTRAINT "PurchaseInvoicePayment_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoicePayment" ADD CONSTRAINT "PurchaseInvoicePayment_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
