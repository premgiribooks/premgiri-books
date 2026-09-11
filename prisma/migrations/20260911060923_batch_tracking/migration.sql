-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isBatchTracked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StockTransaction" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "ProductBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "manufactureDate" DATE,
    "expiryDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductBatch_companyId_productId_idx" ON "ProductBatch"("companyId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBatch_companyId_productId_batchNumber_key" ON "ProductBatch"("companyId", "productId", "batchNumber");

-- CreateIndex
CREATE INDEX "StockTransaction_batchId_idx" ON "StockTransaction"("batchId");

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 50-batch-tracking.md's Data Model calls for a raw-SQL CHECK constraint
-- enforcing that a product may be isBatchTracked or isSerialTracked, never
-- both. That constraint is deliberately NOT added in this migration:
-- Product.isSerialTracked does not exist yet (it is feature-spec 51,
-- Serial Number Tracking, not yet implemented), and a Postgres CHECK can
-- only reference existing columns. Adding isSerialTracked here would violate
-- ai-workflow-rules.md's "one feature at a time." Feature-spec 51's own
-- migration must add both of the following when it introduces
-- isSerialTracked / StockTransaction.serialId:
--
--   ALTER TABLE "Product" ADD CONSTRAINT "product_batch_serial_mutually_exclusive"
--     CHECK (NOT ("isBatchTracked" AND "isSerialTracked"));
--
--   ALTER TABLE "StockTransaction" ADD CONSTRAINT "stock_transaction_batch_xor_serial"
--     CHECK (NOT ("batchId" IS NOT NULL AND "serialId" IS NOT NULL));
--
-- See context/progress-tracker.md for the full record of this deferral.
