// One-off migration: imports the legacy SQLite database (prod.db) into this
// app's Postgres schema, using the app's own business engines (GST,
// Inventory, Voucher, Document Number) so tax, round-off, stock, and ledger
// postings are recomputed rather than copied — see scripts/migrate/*.ts for
// the detailed mapping, and MIGRATION-REMARKS.md (written at the end) for
// every gap/judgment call that still needs your review.
//
// Usage:
//   npx prisma migrate deploy                          # create the schema first (empty DB)
//   npx tsx scripts/migrate-legacy-data.ts              # preview only — no writes
//   npx tsx scripts/migrate-legacy-data.ts --execute     # actually migrate
//
// Optional: --legacy-db=<path> (defaults to D:/My/BPG/Premgiri-books-v2/prod.db)
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { LegacyDb } from "./migrate/legacy-db";
import { migrateMasters } from "./migrate/masters";
import { migrateSalesInvoices, migratePurchaseInvoices } from "./migrate/documents";
import { Remarks } from "./migrate/remarks";

const DEFAULT_LEGACY_DB_PATH = "D:/My/BPG/Premgiri-books-v2/prod.db";

function parseArgs(argv: string[]): { execute: boolean; legacyDbPath: string } {
  const execute = argv.includes("--execute");
  const pathArg = argv.find((a) => a.startsWith("--legacy-db="));
  const legacyDbPath = pathArg ? pathArg.slice("--legacy-db=".length) : DEFAULT_LEGACY_DB_PATH;
  return { execute, legacyDbPath };
}

async function main(): Promise<void> {
  const { execute, legacyDbPath } = parseArgs(process.argv.slice(2));
  const legacy = new LegacyDb(legacyDbPath);

  try {
    const company = legacy.company();
    const ledgers = legacy.ledgers();
    const stockItems = legacy.stockItems();
    const salesVouchers = legacy.vouchers("SALES");
    const purchaseVouchers = legacy.vouchers("PURCHASE");

    console.log("Legacy data summary:");
    console.log(`  Company: ${company.name} (GSTIN ${company.gstin ?? "none"}, state ${company.stateCode ?? "unknown"})`);
    console.log(`  Ledgers: ${ledgers.length}`);
    console.log(`  Products (stock_items): ${stockItems.length}`);
    console.log(`  Sales vouchers: ${salesVouchers.length} (${salesVouchers.filter((v) => v.status === "CANCELLED").length} cancelled)`);
    console.log(`  Purchase vouchers: ${purchaseVouchers.length} (${purchaseVouchers.filter((v) => v.status === "CANCELLED").length} cancelled)`);

    if (company.gstin) {
      const existing = await prisma.company.findUnique({ where: { gstin: company.gstin } });
      if (existing) {
        throw new Error(
          `A company with GSTIN ${company.gstin} already exists in the target database (id ${existing.id}) — refusing to run a second time. If this is intentional, remove that company first.`
        );
      }
    }

    if (!execute) {
      console.log("\nDry run only (pass --execute to actually migrate). No changes were made.");
      return;
    }

    const remarks = new Remarks();
    console.log("\nCreating company, financial year, chart of accounts, and masters...");
    const masters = await migrateMasters(legacy, remarks);
    console.log(`Masters created. companyId=${masters.companyId} financialYearId=${masters.financialYearId}`);

    console.log("\nMigrating sales invoices...");
    const salesCount = await migrateSalesInvoices(legacy, masters, remarks);
    console.log(`Migrated ${salesCount} sales invoices.`);

    console.log("\nMigrating purchase invoices...");
    const purchaseCount = await migratePurchaseInvoices(legacy, masters, remarks);
    console.log(`Migrated ${purchaseCount} purchase invoices.`);

    if (masters.inactiveLegacyProductIds.length > 0) {
      console.log(`\nDeactivating ${masters.inactiveLegacyProductIds.length} product(s) inactive in the legacy data...`);
      await prisma.product.updateMany({
        where: { id: { in: masters.inactiveLegacyProductIds } },
        data: { isActive: false },
      });
      remarks.add(
        `${masters.inactiveLegacyProductIds.length} product(s) were inactive in the legacy data — created active (so their historical stock movements could be recorded) and deactivated again once every voucher was migrated.`
      );
    }

    console.log("\nRestoring allowNegativeStock to false (import-only setting)...");
    await prisma.companySettings.update({
      where: { companyId: masters.companyId },
      data: { allowNegativeStock: false },
    });

    const remarksPath = "MIGRATION-REMARKS.md";
    await remarks.write(remarksPath);
    console.log(`\nDone. Wrote ${remarksPath} — please review it before using the migrated data.`);
  } finally {
    legacy.close();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
