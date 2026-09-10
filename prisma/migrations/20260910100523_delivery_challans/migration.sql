-- CreateEnum
CREATE TYPE "DeliveryChallanStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'INVOICED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DeliveryChallan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "challanNumber" TEXT NOT NULL,
    "challanDate" DATE NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "status" "DeliveryChallanStatus" NOT NULL DEFAULT 'DRAFT',
    "narration" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryChallanItem" (
    "id" TEXT NOT NULL,
    "deliveryChallanId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "salesOrderItemId" TEXT,

    CONSTRAINT "DeliveryChallanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryChallan_companyId_customerId_idx" ON "DeliveryChallan"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_companyId_status_idx" ON "DeliveryChallan"("companyId", "status");

-- CreateIndex
CREATE INDEX "DeliveryChallan_salesOrderId_idx" ON "DeliveryChallan"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallan_companyId_financialYearId_challanNumber_key" ON "DeliveryChallan"("companyId", "financialYearId", "challanNumber");

-- CreateIndex
CREATE INDEX "DeliveryChallanItem_productId_idx" ON "DeliveryChallanItem"("productId");

-- CreateIndex
CREATE INDEX "DeliveryChallanItem_warehouseId_idx" ON "DeliveryChallanItem"("warehouseId");

-- CreateIndex
CREATE INDEX "DeliveryChallanItem_salesOrderItemId_idx" ON "DeliveryChallanItem"("salesOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallanItem_deliveryChallanId_lineNumber_key" ON "DeliveryChallanItem"("deliveryChallanId", "lineNumber");

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_deliveryChallanId_fkey" FOREIGN KEY ("deliveryChallanId") REFERENCES "DeliveryChallan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
