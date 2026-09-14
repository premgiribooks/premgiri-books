// Creates the company, financial year, chart of accounts, and every master
// (units, categories, HSN codes, GST rate, warehouse, ledgers, customers,
// suppliers, products) that the legacy SQLite data maps onto — using the same
// session-free primitives prisma/seed.ts itself uses for company bootstrap
// (tenantBootstrapService.bootstrapTenant, ledgerService.createUnderGroup),
// plus direct Prisma writes validated against the same Zod schemas the real
// services use, since every module service requires a live Next.js session
// this standalone script cannot provide (confirmed by reading every service
// in src/modules/{units,categories,hsn-codes,gst-rates,warehouses,ledgers,
// customers,suppliers,products} before writing this file).
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { permissionService } from "@/modules/roles/services/permission-service";
import { tenantBootstrapService } from "@/modules/administration/services/tenant-bootstrap-service";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import { inventoryEngine } from "@/engines/inventory/inventory-engine";
import {
  SUNDRY_DEBTORS_GROUP_NAME,
  SUNDRY_CREDITORS_GROUP_NAME,
  BANK_ACCOUNTS_GROUP_NAME,
  DUTIES_AND_TAXES_GROUP_NAME,
  INDIRECT_EXPENSES_GROUP_NAME,
} from "@/modules/ledger-groups/constants/default-groups";
import type { LegacyDb, LegacyLedger, LegacyStockItem } from "./legacy-db";
import type { Remarks } from "./remarks";

const SALES_ACCOUNTS_GROUP_NAME = "Sales Accounts";
const PURCHASE_ACCOUNTS_GROUP_NAME = "Purchase Accounts";

export interface MastersResult {
  companyId: string;
  companyStateCode: string;
  financialYearId: string;
  defaultWarehouseId: string;
  singleGstRateId: string;
  salesLedgerId: string;
  purchaseLedgerId: string;
  roundOffLedgerId: string;
  outputCgstLedgerId: string;
  outputSgstLedgerId: string;
  outputIgstLedgerId: string;
  outputCessLedgerId: string;
  inputCgstLedgerId: string;
  inputSgstLedgerId: string;
  inputIgstLedgerId: string;
  inputCessLedgerId: string;
  inactiveLegacyProductIds: string[];
  unitIdByLegacyId: Map<string, { id: string; decimalPlaces: number }>;
  customerIdByLegacyLedgerId: Map<string, string>;
  supplierIdByLegacyLedgerId: Map<string, string>;
  productIdByLegacyItemId: Map<string, { id: string; unitDecimalPlaces: number }>;
  companyAdminUsername: string;
}

async function findGroupId(tx: Prisma.TransactionClient, companyId: string, name: string): Promise<string> {
  const group = await tx.ledgerGroup.findFirst({ where: { companyId, name } });
  if (!group) {
    throw new Error(`Expected default ledger group "${name}" to already exist for company ${companyId}.`);
  }
  return group.id;
}

async function createGlLedger(
  tx: Prisma.TransactionClient,
  companyId: string,
  groupId: string,
  name: string
): Promise<string> {
  const ledger = await ledgerService.createUnderGroup(
    companyId,
    groupId,
    { name, openingBalance: 0, openingBalanceType: "DEBIT", isSystemDefined: true },
    tx
  );
  return ledger.id;
}

export async function migrateMasters(legacy: LegacyDb, remarks: Remarks): Promise<MastersResult> {
  const legacyCompany = legacy.company();
  const legacyLedgers = legacy.ledgers();
  const legacyUnits = legacy.units();
  const legacyStockGroups = legacy.stockGroups();
  const legacyStockItems = legacy.stockItems();

  if (!legacyCompany.stateCode) {
    throw new Error("Legacy company has no stateCode — cannot determine intra/inter-state GST supply type.");
  }

  const fyYearStart = 2026; // derived from the observed voucher date range (2026-05 .. 2026-09), fyStart month = 4 (April)
  const financialYearName = `${fyYearStart}-${String((fyYearStart + 1) % 100).padStart(2, "0")}`;
  const startDate = `${fyYearStart}-04-01`;
  const endDate = `${fyYearStart + 1}-03-31`;

  const seedAdminPassword = process.env["SEED_ADMIN_PASSWORD"] ?? "Admin@12345";
  const seedSuperAdminPassword = process.env["SEED_SUPER_ADMIN_PASSWORD"] ?? "SuperAdmin@12345";

  const result = await prisma.$transaction(
    async (tx) => {
      await permissionService.ensureCatalog();

      const existingSuperAdmin = await tx.user.findFirst({ where: { userType: "PLATFORM" } });
      if (!existingSuperAdmin) {
        await tx.user.create({
          data: {
            username: "superadmin",
            fullName: "Super Admin",
            email: "superadmin@premgiribooks.local",
            passwordHash: await hashPassword(seedSuperAdminPassword),
            userType: "PLATFORM",
          },
        });
      } else {
        remarks.add("A PLATFORM super admin user already existed — did not create a second one.");
      }

      const preExistingAdmin = await tx.user.findUnique({ where: { username: "admin" } });
      if (preExistingAdmin) {
        remarks.add(
          `A user named "admin" already existed in this database before this migration ran (likely from an earlier prisma/seed.ts bootstrap of a "Default Company") and was left untouched. If that company has no real data, consider deleting it; the migrated company's admin is "bpg_admin" instead.`
        );
      }

      const company = await tx.company.create({
        data: {
          companyName: legacyCompany.name,
          legalName: legacyCompany.name,
          gstin: legacyCompany.gstin,
          pan: legacyCompany.pan,
          stateCode: legacyCompany.stateCode,
          addressLine1: legacyCompany.address,
          country: "India",
          settings: { create: {} },
        },
      });
      const companyId = company.id;

      const { companyAdminRoleId } = await tenantBootstrapService.bootstrapTenant(
        companyId,
        { financialYear: { name: financialYearName, startDate, endDate } },
        tx
      );

      const financialYear = await tx.financialYear.findFirstOrThrow({ where: { companyId } });

      const companyAdminUsername = "bpg_admin";
      await tx.user.create({
        data: {
          username: companyAdminUsername,
          fullName: "Company Admin",
          email: "bpg-admin@premgiribooks.local",
          passwordHash: await hashPassword(seedAdminPassword),
          userType: "COMPANY",
          companyId,
          roleId: companyAdminRoleId,
        },
      });

      // ——— Units of measure ———
      const unitIdByLegacyId = new Map<string, { id: string; decimalPlaces: number }>();
      for (const u of legacyUnits) {
        const decimalPlaces = u.symbol === "KG" || u.symbol === "LTR" ? 2 : 0;
        const created = await tx.unit.create({
          data: { companyId, name: u.name, symbol: u.symbol, decimalPlaces },
        });
        unitIdByLegacyId.set(u.id, { id: created.id, decimalPlaces });
      }

      // ——— Category (from the single legacy stock group) ———
      const categoryIdByLegacyId = new Map<string, string>();
      for (const g of legacyStockGroups) {
        const created = await tx.category.create({ data: { companyId, name: g.name } });
        categoryIdByLegacyId.set(g.id, created.id);
      }

      // ——— HSN codes (deduplicated) ———
      const distinctHsnCodes = [...new Set(legacyStockItems.map((s) => s.hsnCode).filter((c): c is string => !!c))];
      const hsnIdByCode = new Map<string, string>();
      for (const code of distinctHsnCodes) {
        // Every legacy product is a TRADING good (paints/thinners), never a
        // service, so every code is classified HSN — no SAC codes exist in
        // this legacy data.
        const created = await tx.hsnCode.create({
          data: {
            companyId,
            code,
            codeType: "HSN",
            description: "Migrated from legacy system — description not available, please update.",
          },
        });
        hsnIdByCode.set(code, created.id);
      }
      if (distinctHsnCodes.length > 0) {
        remarks.add(
          `${distinctHsnCodes.length} HSN codes were migrated with a placeholder description ("Migrated from legacy system…") — the legacy data only stored bare codes. Please enter real descriptions under Masters > HSN Codes.`
        );
      }
      const blankHsnCount = legacyStockItems.filter((s) => !s.hsnCode).length;
      if (blankHsnCount > 0) {
        remarks.add(
          `${blankHsnCount} products had no HSN code in the legacy data and were migrated with hsnCodeId left unset. Please assign the correct HSN code to each under Masters > Products.`
        );
      }

      // ——— Single GST rate (legacy data is uniformly 18%) ———
      const distinctRates = [...new Set(legacyStockItems.map((s) => s.gstRate))];
      if (distinctRates.length > 1) {
        remarks.add(
          `Legacy data actually had ${distinctRates.length} distinct GST rate percentages (${distinctRates.join(", ")}), not the single 18% assumed — only one GstRate row ("GST 18%") was created; review Masters > GST Rates and reassign products with a different rate.`
        );
      }
      const gstRate = await tx.gstRate.create({
        data: { companyId, name: "GST 18%", ratePercent: 18, cessPercent: 0 },
      });

      // ——— Warehouse (legacy system had no warehouse/godown concept) ———
      const warehouse = await tx.warehouse.create({
        data: { companyId, name: "Main Warehouse", code: "MAIN", isDefault: true },
      });
      remarks.add(
        'The legacy system had no warehouse concept, so every product/stock movement was migrated into a single synthesized "Main Warehouse". Create additional warehouses and use Stock Transfer if stock actually needs splitting across locations.'
      );

      // ——— GL ledgers the legacy system modeled as one combined "GST Payable" ledger ———
      const salesGroupId = await findGroupId(tx, companyId, SALES_ACCOUNTS_GROUP_NAME);
      const purchaseGroupId = await findGroupId(tx, companyId, PURCHASE_ACCOUNTS_GROUP_NAME);
      const dutiesGroupId = await findGroupId(tx, companyId, DUTIES_AND_TAXES_GROUP_NAME);
      const indirectExpensesGroupId = await findGroupId(tx, companyId, INDIRECT_EXPENSES_GROUP_NAME);
      const sundryDebtorsGroupId = await findGroupId(tx, companyId, SUNDRY_DEBTORS_GROUP_NAME);
      const sundryCreditorsGroupId = await findGroupId(tx, companyId, SUNDRY_CREDITORS_GROUP_NAME);
      const bankAccountsGroupId = await findGroupId(tx, companyId, BANK_ACCOUNTS_GROUP_NAME);

      const salesLedgerId = await createGlLedger(tx, companyId, salesGroupId, "Sales Income");
      const purchaseLedgerId = await createGlLedger(tx, companyId, purchaseGroupId, "Purchase Account");
      const roundOffLedgerId = await createGlLedger(tx, companyId, indirectExpensesGroupId, "Round Off");
      const outputCgstLedgerId = await createGlLedger(tx, companyId, dutiesGroupId, "Output CGST");
      const outputSgstLedgerId = await createGlLedger(tx, companyId, dutiesGroupId, "Output SGST");
      const outputIgstLedgerId = await createGlLedger(tx, companyId, dutiesGroupId, "Output IGST");
      const outputCessLedgerId = await createGlLedger(tx, companyId, dutiesGroupId, "Output Cess");
      const inputCgstLedgerId = await createGlLedger(tx, companyId, dutiesGroupId, "Input CGST");
      const inputSgstLedgerId = await createGlLedger(tx, companyId, dutiesGroupId, "Input SGST");
      const inputIgstLedgerId = await createGlLedger(tx, companyId, dutiesGroupId, "Input IGST");
      const inputCessLedgerId = await createGlLedger(tx, companyId, dutiesGroupId, "Input Cess");

      remarks.add(
        'The legacy system posted both output (sales) and input (purchase) GST into one combined "GST Payable" ledger. This migration splits that into 8 proper Output/Input CGST/SGST/IGST/Cess ledgers under "Duties & Taxes" (correct GST/ITC accounting practice) — the old combined ledger was not recreated.'
      );

      await tx.companySettings.update({
        where: { companyId },
        data: {
          salesLedgerId,
          outputCgstLedgerId,
          outputSgstLedgerId,
          outputIgstLedgerId,
          outputCessLedgerId,
          roundOffLedgerId,
          purchaseLedgerId,
          inputCgstLedgerId,
          inputSgstLedgerId,
          inputIgstLedgerId,
          inputCessLedgerId,
          // Set true only for the duration of the historical import (see
          // documents.ts) — restored to false once every legacy voucher is
          // replayed, matching the business's real day-to-day setting.
          allowNegativeStock: true,
        },
      });

      // ——— Bank ledger ———
      const bankLedgers = legacyLedgers.filter((l) => l.groupName === BANK_ACCOUNTS_GROUP_NAME);
      for (const bl of bankLedgers) {
        const ledger = await ledgerService.createUnderGroup(
          companyId,
          bankAccountsGroupId,
          { name: bl.name, openingBalance: 0, openingBalanceType: "DEBIT" },
          tx
        );
        if (bl.bankAccount && bl.ifsc) {
          await tx.bankAccount.create({
            data: {
              companyId,
              ledgerId: ledger.id,
              bankName: bl.bankName ?? bl.name,
              accountNumber: bl.bankAccount,
              ifscCode: bl.ifsc,
              branchName: bl.bankName ?? "Unknown",
              accountHolderName: legacyCompany.name,
            },
          });
        }
      }

      // ——— Customers (Sundry Debtors) and Suppliers (Sundry Creditors) ———
      const customerIdByLegacyLedgerId = new Map<string, string>();
      const supplierIdByLegacyLedgerId = new Map<string, string>();

      async function createParty(l: LegacyLedger, groupId: string, kind: "customer" | "supplier"): Promise<string> {
        const ledger = await ledgerService.createUnderGroup(
          companyId,
          groupId,
          {
            name: l.name,
            openingBalance: Math.abs(l.openingBalance),
            openingBalanceType: l.drCr === "CR" ? "CREDIT" : "DEBIT",
          },
          tx
        );
        if (kind === "customer") {
          const customer = await tx.customer.create({
            data: {
              companyId,
              ledgerId: ledger.id,
              customerType: "RETAIL",
              gstin: l.gstin,
              pan: l.pan,
              creditDays: l.creditDays,
              isActive: l.isActive === 1,
            },
          });
          return customer.id;
        }
        const supplier = await tx.supplier.create({
          data: {
            companyId,
            ledgerId: ledger.id,
            gstin: l.gstin,
            pan: l.pan,
            creditDays: l.creditDays,
            isActive: l.isActive === 1,
          },
        });
        return supplier.id;
      }

      for (const l of legacyLedgers) {
        if (l.groupName === SUNDRY_DEBTORS_GROUP_NAME) {
          customerIdByLegacyLedgerId.set(l.id, await createParty(l, sundryDebtorsGroupId, "customer"));
        } else if (l.groupName === SUNDRY_CREDITORS_GROUP_NAME) {
          supplierIdByLegacyLedgerId.set(l.id, await createParty(l, sundryCreditorsGroupId, "supplier"));
        }
      }

      // ——— Products ———
      const productIdByLegacyItemId = new Map<string, { id: string; unitDecimalPlaces: number }>();
      let productSeq = 0;
      const inactiveLegacyProductIds: string[] = [];
      for (const item of legacyStockItems) {
        productSeq += 1;
        const unit = unitIdByLegacyId.get(item.uomId);
        if (!unit) {
          throw new Error(`Product "${item.name}" references unknown legacy unit ${item.uomId}.`);
        }
        const created = await tx.product.create({
          data: {
            companyId,
            name: item.name,
            productCode: `LEG-${String(productSeq).padStart(4, "0")}`,
            productType: "TRADING",
            categoryId: categoryIdByLegacyId.get(item.groupId) ?? null,
            unitId: unit.id,
            hsnCodeId: item.hsnCode ? (hsnIdByCode.get(item.hsnCode) ?? null) : null,
            gstRateId: gstRate.id,
            defaultWarehouseId: warehouse.id,
            purchasePrice: item.openingRate || null,
            // Created active regardless of the legacy flag — the Inventory
            // Engine refuses stock movements against an inactive product, and
            // every later Sales/Purchase Invoice line for this same item also
            // needs it active. Deactivated back to the legacy value below,
            // once every voucher line has run against it.
            isActive: true,
          },
        });
        productIdByLegacyItemId.set(item.id, { id: created.id, unitDecimalPlaces: unit.decimalPlaces });
        if (item.isActive !== 1) {
          inactiveLegacyProductIds.push(created.id);
        }

        if (item.openingQty > 0) {
          await inventoryEngine.recordMovements(
            companyId,
            [
              {
                productId: created.id,
                warehouseId: warehouse.id,
                transactionType: "OPENING_STOCK",
                direction: "IN",
                quantity: item.openingQty,
                unitCost: item.openingRate || undefined,
                transactionDate: startDate,
                narration: "Migrated legacy opening stock",
              },
            ],
            tx
          );
        }
      }

      const junkProducts = legacyStockItems.filter((s) => /^test1?$/i.test(s.name.trim()));
      if (junkProducts.length > 0) {
        remarks.add(
          `${junkProducts.length} product(s) named "${junkProducts.map((p) => p.name).join('", "')}" look like test data (never used in any legacy transaction) — migrated as-is for faithfulness; consider deactivating/deleting them under Masters > Products.`
        );
      }

      return {
        companyId,
        companyStateCode: legacyCompany.stateCode as string,
        financialYearId: financialYear.id,
        defaultWarehouseId: warehouse.id,
        singleGstRateId: gstRate.id,
        salesLedgerId,
        purchaseLedgerId,
        roundOffLedgerId,
        outputCgstLedgerId,
        outputSgstLedgerId,
        outputIgstLedgerId,
        outputCessLedgerId,
        inputCgstLedgerId,
        inputSgstLedgerId,
        inputIgstLedgerId,
        inputCessLedgerId,
        inactiveLegacyProductIds,
        unitIdByLegacyId,
        customerIdByLegacyLedgerId,
        supplierIdByLegacyLedgerId,
        productIdByLegacyItemId,
        companyAdminUsername,
      };
    },
    { timeout: 300_000, maxWait: 30_000 }
  );

  remarks.add(
    `Company Admin created: username "bpg_admin" (not "admin" — that username was already taken by a pre-existing "Default Company" seeded earlier in this database) — password from SEED_ADMIN_PASSWORD if set in your environment, otherwise the local-development default documented in prisma/seed.ts ("Admin@12345"). Change it after first login.`
  );
  remarks.add(
    `Super Admin created (if none existed): username "superadmin" — password from SEED_SUPER_ADMIN_PASSWORD if set, otherwise the local-development default documented in prisma/seed.ts. Change it after first login.`
  );
  remarks.add(
    'The legacy admin user (admin@premgiribooks.com) was NOT migrated as a login — its password hash uses an incompatible scheme. Use the new "admin" Company Admin account above instead.'
  );

  return result;
}
