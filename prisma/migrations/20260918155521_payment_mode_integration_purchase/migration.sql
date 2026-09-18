-- AlterTable
ALTER TABLE "PurchaseInvoicePayment" ADD COLUMN     "paymentModeId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseReturn" ADD COLUMN     "paymentModeId" TEXT;

-- A company created before 86-payment-mode-master.md shipped never received
-- the COMPANY_BOOTSTRAPPED-triggered seed defaults retroactively — only
-- newly-created companies get seeded via
-- src/modules/payment-modes/events/register-bootstrap-handler.ts. Without
-- this step, the backfill below would silently match zero rows for any such
-- company, leaving paymentModeId NULL and making the NOT NULL constraint a
-- few lines down fail the whole migration (the exact deployment-blocking gap
-- 20260918043848_payment_mode_integration_sales's own migration hit and
-- fixed — code review + security review both independently flagged it
-- there). Every company that has at least one existing PurchaseInvoicePayment
-- row but no "Cash" Payment Mode gets one created here, mirroring the seeded
-- default's own shape exactly (isSystemDefined: true, ledgerClass: CASH).
INSERT INTO "PaymentMode" ("id", "companyId", "name", "ledgerClass", "isSystemDefined", "isActive", "updatedAt")
SELECT DISTINCT gen_random_uuid()::TEXT, pi."companyId", 'Cash', 'CASH'::"PaymentModeLedgerClass", true, true, CURRENT_TIMESTAMP
FROM "PurchaseInvoice" pi
JOIN "PurchaseInvoicePayment" pip ON pip."purchaseInvoiceId" = pi."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "PaymentMode" pm WHERE pm."companyId" = pi."companyId" AND pm."name" = 'Cash'
);

-- Backfill: every existing PurchaseInvoicePayment row is assigned its own
-- company's "Cash" Payment Mode (92-payment-mode-integration-purchase.md's
-- Business Rules — "a technical default; no business logic is re-run").
-- Hand-written because `prisma migrate dev` refuses to generate a NOT NULL
-- column with no default against a non-empty table.
UPDATE "PurchaseInvoicePayment" pip
SET "paymentModeId" = pm.id
FROM "PurchaseInvoice" pi
JOIN "PaymentMode" pm ON pm."companyId" = pi."companyId" AND pm."name" = 'Cash'
WHERE pip."purchaseInvoiceId" = pi."id";

-- PurchaseInvoicePayment.paymentModeId is required going forward — every
-- new payment line must name a mode. PurchaseReturn.paymentModeId stays
-- nullable (required only when refundMode is CASH_REFUND, enforced in
-- purchase-return-service.ts, not the database) and is left NULL on
-- existing rows, matching SalesReturn.paymentModeId's own precedent.
ALTER TABLE "PurchaseInvoicePayment" ALTER COLUMN "paymentModeId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "PurchaseInvoicePayment_paymentModeId_idx" ON "PurchaseInvoicePayment"("paymentModeId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_paymentModeId_idx" ON "PurchaseReturn"("paymentModeId");

-- AddForeignKey
ALTER TABLE "PurchaseInvoicePayment" ADD CONSTRAINT "PurchaseInvoicePayment_paymentModeId_fkey" FOREIGN KEY ("paymentModeId") REFERENCES "PaymentMode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_paymentModeId_fkey" FOREIGN KEY ("paymentModeId") REFERENCES "PaymentMode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
