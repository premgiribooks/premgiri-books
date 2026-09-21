-- AlterTable
-- Product code becomes optional, per explicit user request (2026-09-20) —
-- some products the user carries have no SKU of their own. The existing
-- @@unique([companyId, productCode]) constraint is unaffected: Postgres
-- already treats multiple NULLs in a unique index as distinct, exactly like
-- the "barcode" column's own long-standing nullable-and-unique-when-present
-- pattern.
ALTER TABLE "Product" ALTER COLUMN "productCode" DROP NOT NULL;
