-- CreateEnum
CREATE TYPE "PurchasePriceSourceType" AS ENUM ('PURCHASE_INVOICE', 'PURCHASE_ORDER');

-- CreateTable
CREATE TABLE "ProductPurchasePriceHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "oldPurchasePrice" DECIMAL(14,2),
    "newPurchasePrice" DECIMAL(14,2) NOT NULL,
    "sourceDocumentType" "PurchasePriceSourceType" NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "sourceDocumentNumber" TEXT,
    "sourceDocumentDate" DATE NOT NULL,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPurchasePriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPurchasePriceHistory_companyId_productId_createdAt_idx" ON "ProductPurchasePriceHistory"("companyId", "productId", "createdAt");

-- CreateIndex
-- Name exceeds Postgres's 63-byte identifier limit; Postgres truncates it
-- automatically on creation (standard NAMEDATALEN behavior, no error) —
-- this is the exact name `prisma migrate dev` would itself have generated
-- and handed to Postgres, kept verbatim here for fidelity with what a
-- from-scratch rebuild of this migration history would produce.
CREATE INDEX "ProductPurchasePriceHistory_sourceDocumentType_sourceDocumentId_idx" ON "ProductPurchasePriceHistory"("sourceDocumentType", "sourceDocumentId");

-- CreateIndex
CREATE INDEX "ProductPurchasePriceHistory_companyId_idx" ON "ProductPurchasePriceHistory"("companyId");

-- AddForeignKey
ALTER TABLE "ProductPurchasePriceHistory" ADD CONSTRAINT "ProductPurchasePriceHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPurchasePriceHistory" ADD CONSTRAINT "ProductPurchasePriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPurchasePriceHistory" ADD CONSTRAINT "ProductPurchasePriceHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
