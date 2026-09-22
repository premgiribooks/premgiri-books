import { Prisma, type CreditNoteStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { fetchPage, type Page, type PageParams } from "@/lib/pagination";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  PurchaseCreditNoteDetail,
  PurchaseCreditNoteInvoiceOption,
  PurchaseCreditNoteItemDetail,
  PurchaseCreditNoteListFilters,
  PurchaseCreditNoteListRow,
} from "@/types/purchase-credit-note";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const SUPPLIER_INCLUDE = {
  supplier: { select: { id: true, ledger: { select: { name: true } } } },
} as const;

const PURCHASE_INVOICE_INCLUDE = {
  purchaseInvoice: { select: { id: true, invoiceNumber: true, invoiceDate: true } },
} as const;

const ITEM_INCLUDE = { items: true } as const;

type PurchaseCreditNoteListRowRaw = Prisma.PurchaseCreditNoteGetPayload<{
  include: typeof SUPPLIER_INCLUDE & typeof PURCHASE_INVOICE_INCLUDE;
}>;
type PurchaseCreditNoteDetailRaw = Prisma.PurchaseCreditNoteGetPayload<{
  include: typeof SUPPLIER_INCLUDE & typeof PURCHASE_INVOICE_INCLUDE & typeof ITEM_INCLUDE;
}>;

const PURCHASE_CREDIT_NOTE_ITEM_DECIMAL_FIELDS = [
  "taxableAmount",
  "ratePercent",
  "cessPercent",
  "cgst",
  "sgst",
  "igst",
  "cess",
  "totalAmount",
] as const;

const PURCHASE_CREDIT_NOTE_DECIMAL_FIELDS = ["taxableAmount", "totalCgst", "totalSgst", "totalIgst", "totalCess", "grandTotal"] as const;

function toPurchaseCreditNoteListRow(raw: PurchaseCreditNoteListRowRaw): PurchaseCreditNoteListRow {
  const { supplier, purchaseInvoice, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of PURCHASE_CREDIT_NOTE_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  return {
    ...(normalizedHeader as unknown as PurchaseCreditNoteListRow),
    supplier: { id: supplier.id, name: supplier.ledger.name },
    // A linked invoice is only ever a POSTED one (assigned invoiceNumber) —
    // mirrors purchase-return-repository.ts's identical `as string` cast.
    purchaseInvoice: purchaseInvoice ? { ...purchaseInvoice, invoiceNumber: purchaseInvoice.invoiceNumber as string } : null,
  };
}

function toPurchaseCreditNoteDetail(raw: PurchaseCreditNoteDetailRaw): PurchaseCreditNoteDetail {
  const { supplier, purchaseInvoice, items, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of PURCHASE_CREDIT_NOTE_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row
  // order (credit-note-repository.ts's identical note).
  const normalizedItems: PurchaseCreditNoteItemDetail[] = items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => {
      const line: Record<string, unknown> = { ...item };
      for (const field of PURCHASE_CREDIT_NOTE_ITEM_DECIMAL_FIELDS) {
        line[field] = (item as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
      }
      return line as unknown as PurchaseCreditNoteItemDetail;
    });

  return {
    ...(normalizedHeader as unknown as PurchaseCreditNoteDetail),
    supplier: { id: supplier.id, name: supplier.ledger.name },
    purchaseInvoice: purchaseInvoice ? { ...purchaseInvoice, invoiceNumber: purchaseInvoice.invoiceNumber as string } : null,
    items: normalizedItems,
  };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: PurchaseCreditNoteListFilters
): Prisma.PurchaseCreditNoteWhereInput {
  const where: Prisma.PurchaseCreditNoteWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.supplierId) {
    where.supplierId = filters.supplierId;
  }
  if (filters.fromDate || filters.toDate) {
    where.noteDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { noteNumber: { contains: filters.search, mode: "insensitive" } },
      { supplier: { ledger: { name: { contains: filters.search, mode: "insensitive" } } } },
      { purchaseInvoice: { invoiceNumber: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  return where;
}

export interface PurchaseCreditNoteLinePersistData {
  description: string;
  taxableAmount: number;
  ratePercent: number;
  cessPercent: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

export interface PurchaseCreditNoteHeaderPersistData {
  supplierId: string;
  purchaseInvoiceId: string | null;
  noteDate: Date;
  placeOfSupplyStateCode: string;
  reason: string;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}

export interface PurchaseInvoiceForPurchaseCreditNote {
  id: string;
  companyId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  status: string;
  supplierId: string;
  placeOfSupplyStateCode: string;
}

export const purchaseCreditNoteRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: PurchaseCreditNoteListFilters = {}
  ): Promise<PurchaseCreditNoteListRow[]> {
    const rows = await prisma.purchaseCreditNote.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: { ...SUPPLIER_INCLUDE, ...PURCHASE_INVOICE_INCLUDE },
      orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toPurchaseCreditNoteListRow);
  },

  /** Infinite-scroll page for the Purchase Credit Notes list — same
   * filters/ordering as `findMany`, just `skip`/`take`-bounded. */
  async findManyPage(
    companyId: string,
    financialYearId: string,
    filters: PurchaseCreditNoteListFilters,
    page: PageParams
  ): Promise<Page<PurchaseCreditNoteListRow>> {
    const result = await fetchPage(
      (args) =>
        prisma.purchaseCreditNote.findMany({
          where: buildWhere(companyId, financialYearId, filters),
          include: { ...SUPPLIER_INCLUDE, ...PURCHASE_INVOICE_INCLUDE },
          orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
          ...args,
        }),
      page
    );
    return { items: result.items.map(toPurchaseCreditNoteListRow), hasMore: result.hasMore };
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<PurchaseCreditNoteDetail | null> {
    const row = await client.purchaseCreditNote.findUnique({
      where: { id },
      include: { ...SUPPLIER_INCLUDE, ...PURCHASE_INVOICE_INCLUDE, ...ITEM_INCLUDE },
    });
    return row ? toPurchaseCreditNoteDetail(row) : null;
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: PurchaseCreditNoteHeaderPersistData,
    lines: PurchaseCreditNoteLinePersistData[],
    createdByUserId: string
  ): Promise<PurchaseCreditNoteDetail> {
    const created = await tx.purchaseCreditNote.create({
      data: {
        companyId,
        financialYearId,
        createdByUserId,
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...SUPPLIER_INCLUDE, ...PURCHASE_INVOICE_INCLUDE, ...ITEM_INCLUDE },
    });
    return toPurchaseCreditNoteDetail(created);
  },

  /** Delete-all-then-recreate the line set inside the caller's transaction —
   * mirrors credit-note-repository.ts's replaceItemsAndUpdate. `noteNumber`
   * is never touched here (only replaceItemsAndPost assigns it). */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly CreditNoteStatus[],
    header: PurchaseCreditNoteHeaderPersistData,
    lines: PurchaseCreditNoteLinePersistData[]
  ): Promise<PurchaseCreditNoteDetail | null> {
    const existing = await tx.purchaseCreditNote.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.purchaseCreditNoteItem.deleteMany({ where: { purchaseCreditNoteId: id } });
    const updated = await tx.purchaseCreditNote.update({
      where: { id },
      data: {
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...SUPPLIER_INCLUDE, ...PURCHASE_INVOICE_INCLUDE, ...ITEM_INCLUDE },
    });
    return toPurchaseCreditNoteDetail(updated);
  },

  /** Posting's own write — replaces the line set with the freshly-recomputed
   * persist data, updates every header total plus `noteNumber`/`voucherId`,
   * and flips `status` to `POSTED` — all atomically, guarded by `WHERE
   * status = 'DRAFT'` so a concurrent status change loses cleanly. */
  async replaceItemsAndPost(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    header: PurchaseCreditNoteHeaderPersistData,
    lines: PurchaseCreditNoteLinePersistData[],
    generated: GeneratedNumber,
    voucherId: string
  ): Promise<PurchaseCreditNoteDetail | null> {
    const existing = await tx.purchaseCreditNote.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || existing.status !== "DRAFT") {
      return null;
    }

    await tx.purchaseCreditNoteItem.deleteMany({ where: { purchaseCreditNoteId: id } });
    const updated = await tx.purchaseCreditNote.update({
      where: { id },
      data: {
        ...header,
        noteNumber: generated.formatted,
        voucherId,
        status: "POSTED",
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...SUPPLIER_INCLUDE, ...PURCHASE_INVOICE_INCLUDE, ...ITEM_INCLUDE },
    });
    return toPurchaseCreditNoteDetail(updated);
  },

  /** Guarded status transition — mirrors credit-note-repository.ts's
   * updateStatus exactly. Drives Cancel (`POSTED -> CANCELLED`) only. */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly CreditNoteStatus[],
    to: CreditNoteStatus
  ): Promise<number> {
    const result = await client.purchaseCreditNote.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  /** Company-scoped lookup of the (optionally) linked source invoice — the
   * read create/update/post all use to validate the supplier match, POSTED
   * status. */
  async findPurchaseInvoiceForPurchaseCreditNote(
    client: PrismaClientOrTransaction,
    companyId: string,
    purchaseInvoiceId: string
  ): Promise<PurchaseInvoiceForPurchaseCreditNote | null> {
    const invoice = await client.purchaseInvoice.findUnique({
      where: { id: purchaseInvoiceId },
      select: {
        id: true,
        companyId: true,
        invoiceNumber: true,
        invoiceDate: true,
        status: true,
        supplierId: true,
        placeOfSupplyStateCode: true,
      },
    });
    if (!invoice || invoice.companyId !== companyId) {
      return null;
    }
    return { ...invoice, invoiceNumber: invoice.invoiceNumber ?? "" };
  },

  async findSupplierForPurchaseCreditNote(
    client: PrismaClientOrTransaction,
    companyId: string,
    supplierId: string
  ): Promise<{ id: string; companyId: string; isActive: boolean; ledgerId: string; name: string } | null> {
    const supplier = await client.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, companyId: true, isActive: true, ledgerId: true, ledger: { select: { name: true } } },
    });
    if (!supplier || supplier.companyId !== companyId) {
      return null;
    }
    return {
      id: supplier.id,
      companyId: supplier.companyId,
      isActive: supplier.isActive,
      ledgerId: supplier.ledgerId,
      name: supplier.ledger.name,
    };
  },

  async findCompanyStateCode(companyId: string): Promise<string | null> {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { stateCode: true } });
    return company?.stateCode ?? null;
  },

  /** The optional invoice picker's search results — POSTED purchase
   * invoices only. */
  async findPostedInvoicesForPicker(
    companyId: string,
    financialYearId: string,
    search?: string
  ): Promise<PurchaseCreditNoteInvoiceOption[]> {
    const rows = await prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        financialYearId,
        status: "POSTED",
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { supplierInvoiceNumber: { contains: search, mode: "insensitive" } },
                { supplier: { ledger: { name: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        placeOfSupplyStateCode: true,
        supplierId: true,
        supplier: { select: { ledger: { select: { name: true } } } },
      },
      orderBy: { invoiceDate: "desc" },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber ?? "",
      invoiceDate: row.invoiceDate,
      supplierId: row.supplierId,
      supplierName: row.supplier.ledger.name,
      placeOfSupplyStateCode: row.placeOfSupplyStateCode,
    }));
  },
};
