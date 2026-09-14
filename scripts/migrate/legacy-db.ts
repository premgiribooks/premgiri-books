// Read-only reader for the legacy SQLite database being migrated into the new
// Postgres schema (see context/feature-specs — this is a one-off operational
// script, not a feature module, same precedent as scripts/setup-database.mjs).
// node:sqlite has no type declarations in the pinned @types/node@20, hence the
// ts-expect-error below; tsx strips types at runtime so this only affects
// `tsc --noEmit`.
// @ts-expect-error -- node:sqlite ships no types under @types/node@20
import { DatabaseSync } from "node:sqlite";

export interface LegacyCompany {
  id: string;
  name: string;
  gstin: string | null;
  pan: string | null;
  stateCode: string | null;
  address: string | null;
  fyStart: number;
}

export interface LegacyAccountGroup {
  id: string;
  name: string;
  parentId: string | null;
  nature: string;
}

export interface LegacyLedger {
  id: string;
  name: string;
  groupId: string;
  groupName: string | null;
  gstin: string | null;
  pan: string | null;
  openingBalance: number;
  drCr: string;
  creditDays: number | null;
  bankName: string | null;
  bankAccount: string | null;
  ifsc: string | null;
  isActive: number;
}

export interface LegacyUnit {
  id: string;
  name: string;
  symbol: string;
}

export interface LegacyStockGroup {
  id: string;
  name: string;
  parentId: string | null;
}

export interface LegacyStockItem {
  id: string;
  name: string;
  groupId: string;
  uomId: string;
  hsnCode: string | null;
  gstRate: number;
  openingQty: number;
  openingRate: number;
  isActive: number;
}

export interface LegacyVoucher {
  id: string;
  voucherType: string;
  voucherNo: string;
  date: string;
  narration: string | null;
  partyLedgerId: string;
  totalAmount: number;
  roundOff: number;
  status: string;
  supplierInvoiceNo: string | null;
  supplierInvoiceDate: string | null;
  createdAt: string;
}

export interface LegacyVoucherItem {
  id: string;
  voucherId: string;
  itemId: string;
  qty: number;
  rate: number;
  discountPct: number;
  discountAmt: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
}

export class LegacyDb {
  private readonly db: InstanceType<typeof DatabaseSync>;

  constructor(filePath: string) {
    this.db = new DatabaseSync(filePath, { readOnly: true });
  }

  company(): LegacyCompany {
    const row = this.db.prepare("SELECT * FROM companies LIMIT 1").get() as LegacyCompany | undefined;
    if (!row) {
      throw new Error("Legacy database has no row in `companies`.");
    }
    return row;
  }

  accountGroups(): LegacyAccountGroup[] {
    return this.db.prepare("SELECT id, name, parentId, nature FROM account_groups").all() as LegacyAccountGroup[];
  }

  ledgers(): LegacyLedger[] {
    return this.db
      .prepare(
        `SELECT l.id, l.name, l.groupId, g.name as groupName, l.gstin, l.pan, l.openingBalance, l.drCr,
                l.creditDays, l.bankName, l.bankAccount, l.ifsc, l.isActive
         FROM ledgers l LEFT JOIN account_groups g ON l.groupId = g.id
         ORDER BY l.createdAt`
      )
      .all() as LegacyLedger[];
  }

  units(): LegacyUnit[] {
    return this.db.prepare("SELECT id, name, symbol FROM units_of_measure").all() as LegacyUnit[];
  }

  stockGroups(): LegacyStockGroup[] {
    return this.db.prepare("SELECT id, name, parentId FROM stock_groups").all() as LegacyStockGroup[];
  }

  stockItems(): LegacyStockItem[] {
    return this.db
      .prepare(
        `SELECT id, name, groupId, uomId, hsnCode, gstRate, openingQty, openingRate, isActive
         FROM stock_items ORDER BY createdAt`
      )
      .all() as LegacyStockItem[];
  }

  vouchers(voucherType: "SALES" | "PURCHASE"): LegacyVoucher[] {
    return this.db
      .prepare(
        `SELECT id, voucherType, voucherNo, date, narration, partyLedgerId, totalAmount, roundOff,
                status, supplierInvoiceNo, supplierInvoiceDate, createdAt
         FROM vouchers WHERE voucherType = ? ORDER BY date, createdAt`
      )
      .all(voucherType) as LegacyVoucher[];
  }

  voucherItems(voucherId: string): LegacyVoucherItem[] {
    return this.db
      .prepare(
        `SELECT id, voucherId, itemId, qty, rate, discountPct, discountAmt, cgstRate, sgstRate, igstRate
         FROM voucher_items WHERE voucherId = ?`
      )
      .all(voucherId) as LegacyVoucherItem[];
  }

  close(): void {
    this.db.close();
  }
}
