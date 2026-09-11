-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isSerialTracked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StockTransaction" ADD COLUMN     "serialId" TEXT;

-- CreateTable
CREATE TABLE "SerialNumber" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialValue" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerialNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SerialNumber_companyId_productId_idx" ON "SerialNumber"("companyId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "SerialNumber_companyId_productId_serialValue_key" ON "SerialNumber"("companyId", "productId", "serialValue");

-- CreateIndex
CREATE INDEX "StockTransaction_serialId_idx" ON "StockTransaction"("serialId");

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "SerialNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 50-batch-tracking.md's migration deferred two raw-SQL CHECK constraints to
-- this migration, since Product.isSerialTracked/StockTransaction.serialId
-- did not exist yet at that time. Adding both now that both columns exist:

-- A product may be isBatchTracked or isSerialTracked, never both.
ALTER TABLE "Product" ADD CONSTRAINT "product_batch_serial_mutually_exclusive"
  CHECK (NOT ("isBatchTracked" AND "isSerialTracked"));

-- A StockTransaction row may carry batchId or serialId, never both.
ALTER TABLE "StockTransaction" ADD CONSTRAINT "stock_transaction_batch_xor_serial"
  CHECK (NOT ("batchId" IS NOT NULL AND "serialId" IS NOT NULL));
