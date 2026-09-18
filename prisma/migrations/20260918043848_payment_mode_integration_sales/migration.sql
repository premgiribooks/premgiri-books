-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN     "paymentModeId" TEXT;

-- AlterTable
ALTER TABLE "SalesInvoicePayment" ADD COLUMN     "paymentModeId" TEXT;

-- AlterTable
ALTER TABLE "SalesReturn" ADD COLUMN     "paymentModeId" TEXT;

-- A company created before 86-payment-mode-master.md shipped never received
-- the COMPANY_BOOTSTRAPPED-triggered seed defaults retroactively — only
-- newly-created companies get seeded via
-- src/modules/payment-modes/events/register-bootstrap-handler.ts. Without
-- this step, the backfill below would silently match zero rows for any such
-- company, leaving paymentModeId NULL and making the NOT NULL constraint a
-- few lines down fail the whole migration (code review + security review
-- finding, both independently flagged this as deployment-blocking). Every
-- company that has at least one existing SalesInvoicePayment row but no
-- "Cash" Payment Mode gets one created here, mirroring the seeded default's
-- own shape exactly (isSystemDefined: true, ledgerClass: CASH).
INSERT INTO "PaymentMode" ("id", "companyId", "name", "ledgerClass", "isSystemDefined", "isActive", "updatedAt")
SELECT DISTINCT gen_random_uuid()::TEXT, si."companyId", 'Cash', 'CASH', true, true, CURRENT_TIMESTAMP
FROM "SalesInvoice" si
JOIN "SalesInvoicePayment" sip ON sip."salesInvoiceId" = si."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "PaymentMode" pm WHERE pm."companyId" = si."companyId" AND pm."name" = 'Cash'
);

-- Backfill: every existing SalesInvoicePayment row is assigned its own
-- company's "Cash" Payment Mode (91-payment-mode-integration-sales.md's
-- Business Rules — "a technical default; no business logic is re-run").
-- Hand-written because `prisma migrate dev` refuses to generate a NOT NULL
-- column with no default against a non-empty table.
UPDATE "SalesInvoicePayment" sip
SET "paymentModeId" = pm.id
FROM "SalesInvoice" si
JOIN "PaymentMode" pm ON pm."companyId" = si."companyId" AND pm."name" = 'Cash'
WHERE sip."salesInvoiceId" = si."id";

-- SalesInvoicePayment.paymentModeId is required going forward — every new
-- payment line must name a mode.
ALTER TABLE "SalesInvoicePayment" ALTER COLUMN "paymentModeId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "CreditNote_paymentModeId_idx" ON "CreditNote"("paymentModeId");

-- CreateIndex
CREATE INDEX "SalesInvoicePayment_paymentModeId_idx" ON "SalesInvoicePayment"("paymentModeId");

-- CreateIndex
CREATE INDEX "SalesReturn_paymentModeId_idx" ON "SalesReturn"("paymentModeId");

-- AddForeignKey
ALTER TABLE "SalesInvoicePayment" ADD CONSTRAINT "SalesInvoicePayment_paymentModeId_fkey" FOREIGN KEY ("paymentModeId") REFERENCES "PaymentMode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_paymentModeId_fkey" FOREIGN KEY ("paymentModeId") REFERENCES "PaymentMode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_paymentModeId_fkey" FOREIGN KEY ("paymentModeId") REFERENCES "PaymentMode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
