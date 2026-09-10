-- CreateEnum
CREATE TYPE "GoodsReceiptNoteStatus" AS ENUM ('DRAFT', 'RECEIVED', 'INVOICED', 'CANCELLED');

-- DropIndex
DROP INDEX "PurchaseOrderItem_purchaseOrderId_idx";

-- CreateTable
CREATE TABLE "GoodsReceiptNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "grnDate" DATE NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "status" "GoodsReceiptNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "narration" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceiptNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptNoteItem" (
    "id" TEXT NOT NULL,
    "goodsReceiptNoteId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "rejectedQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "purchaseOrderItemId" TEXT,

    CONSTRAINT "GoodsReceiptNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_companyId_supplierId_idx" ON "GoodsReceiptNote"("companyId", "supplierId");

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_companyId_status_idx" ON "GoodsReceiptNote"("companyId", "status");

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_purchaseOrderId_idx" ON "GoodsReceiptNote"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptNote_companyId_financialYearId_grnNumber_key" ON "GoodsReceiptNote"("companyId", "financialYearId", "grnNumber");

-- CreateIndex
CREATE INDEX "GoodsReceiptNoteItem_productId_idx" ON "GoodsReceiptNoteItem"("productId");

-- CreateIndex
CREATE INDEX "GoodsReceiptNoteItem_warehouseId_idx" ON "GoodsReceiptNoteItem"("warehouseId");

-- CreateIndex
CREATE INDEX "GoodsReceiptNoteItem_purchaseOrderItemId_idx" ON "GoodsReceiptNoteItem"("purchaseOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptNoteItem_goodsReceiptNoteId_lineNumber_key" ON "GoodsReceiptNoteItem"("goodsReceiptNoteId", "lineNumber");

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNoteItem" ADD CONSTRAINT "GoodsReceiptNoteItem_goodsReceiptNoteId_fkey" FOREIGN KEY ("goodsReceiptNoteId") REFERENCES "GoodsReceiptNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNoteItem" ADD CONSTRAINT "GoodsReceiptNoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNoteItem" ADD CONSTRAINT "GoodsReceiptNoteItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNoteItem" ADD CONSTRAINT "GoodsReceiptNoteItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
