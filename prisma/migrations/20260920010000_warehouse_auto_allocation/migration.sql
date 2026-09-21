-- Warehouse auto-allocation (2026-09-20 feature): a Sales Invoice/Delivery
-- Challan line no longer names a single warehouse — the Inventory Engine's
-- FIFO-by-warehouse-age allocator (src/engines/inventory/
-- warehouse-allocation.ts) now decides which warehouse(s) fulfil it at
-- posting time. Sales Return, which used to inherit its warehouse implicitly
-- from the source SalesInvoiceItem's single warehouseId, gets an explicit
-- picker of its own instead, since that implicit link no longer exists.

-- CreateTable
CREATE TABLE "SalesInvoiceItemWarehouseAllocation" (
    "id" TEXT NOT NULL,
    "salesInvoiceItemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "SalesInvoiceItemWarehouseAllocation_pkey" PRIMARY KEY ("id")
);

-- Backfill: every existing SalesInvoiceItem line becomes its own single
-- warehouse allocation, at its full line quantity — this is exactly what the
-- old single `warehouseId` column already meant (100% of the line was
-- fulfilled from that one warehouse). Preserves historic "fulfilled from"
-- data instead of silently losing it when that column is dropped below.
-- Hand-written because this is a data migration, not something
-- `prisma migrate dev` generates.
INSERT INTO "SalesInvoiceItemWarehouseAllocation" ("id", "salesInvoiceItemId", "warehouseId", "quantity")
SELECT gen_random_uuid()::TEXT, "id", "warehouseId", "quantity"
FROM "SalesInvoiceItem";

-- AlterTable
ALTER TABLE "SalesReturnItem" ADD COLUMN "warehouseId" TEXT;

-- Backfill: a Sales Return used to inherit its warehouse implicitly from the
-- source SalesInvoiceItem's own single warehouseId. Every existing return
-- line is backfilled to the warehouse its source line was allocated to above
-- — each pre-existing line has exactly one allocation row, so this join is
-- unambiguous.
UPDATE "SalesReturnItem" sri
SET "warehouseId" = a."warehouseId"
FROM "SalesInvoiceItemWarehouseAllocation" a
WHERE a."salesInvoiceItemId" = sri."salesInvoiceItemId";

-- SalesReturnItem.warehouseId is required going forward — every return line
-- now names an explicit warehouse (39-sales-return.md's Decisions, updated
-- 2026-09-20).
ALTER TABLE "SalesReturnItem" ALTER COLUMN "warehouseId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "DeliveryChallanItem" DROP CONSTRAINT "DeliveryChallanItem_warehouseId_fkey";

-- DropForeignKey
ALTER TABLE "SalesInvoiceItem" DROP CONSTRAINT "SalesInvoiceItem_warehouseId_fkey";

-- DropIndex
DROP INDEX "DeliveryChallanItem_warehouseId_idx";

-- DropIndex
DROP INDEX "SalesInvoiceItem_warehouseId_idx";

-- AlterTable
ALTER TABLE "DeliveryChallanItem" DROP COLUMN "warehouseId";

-- AlterTable
ALTER TABLE "SalesInvoiceItem" DROP COLUMN "warehouseId";

-- CreateIndex
CREATE INDEX "SalesInvoiceItemWarehouseAllocation_salesInvoiceItemId_idx" ON "SalesInvoiceItemWarehouseAllocation"("salesInvoiceItemId");

-- CreateIndex
CREATE INDEX "SalesInvoiceItemWarehouseAllocation_warehouseId_idx" ON "SalesInvoiceItemWarehouseAllocation"("warehouseId");

-- CreateIndex
CREATE INDEX "SalesReturnItem_warehouseId_idx" ON "SalesReturnItem"("warehouseId");

-- AddForeignKey
ALTER TABLE "SalesInvoiceItemWarehouseAllocation" ADD CONSTRAINT "SalesInvoiceItemWarehouseAllocation_salesInvoiceItemId_fkey" FOREIGN KEY ("salesInvoiceItemId") REFERENCES "SalesInvoiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceItemWarehouseAllocation" ADD CONSTRAINT "SalesInvoiceItemWarehouseAllocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
