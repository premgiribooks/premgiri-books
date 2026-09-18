-- AlterTable
-- 93-payment-mode-integration-manual-vouchers.md: paymentModeId is nullable
-- on Voucher and requires no backfill — Journal Vouchers and every
-- auto-posted document voucher (SALES, PURCHASE, etc.) correctly stay NULL
-- (they either have no payment-mode concept, or record it on the source
-- document's own payment line instead), and existing manual Payment/
-- Receipt/Contra Vouchers remain NULL as accurate historical records
-- predating this feature.
ALTER TABLE "Voucher" ADD COLUMN     "paymentModeId" TEXT;

-- CreateIndex
CREATE INDEX "Voucher_paymentModeId_idx" ON "Voucher"("paymentModeId");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_paymentModeId_fkey" FOREIGN KEY ("paymentModeId") REFERENCES "PaymentMode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
