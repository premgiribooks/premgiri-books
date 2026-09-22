import { Prisma, type DebitNoteStatus } from "@prisma/client";

import { fetchPage, type Page, type PageParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  DebitNoteDetail,
  DebitNoteInvoiceOption,
  DebitNoteItemDetail,
  DebitNoteListFilters,
  DebitNoteListRow,
} from "@/types/debit-note";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const CUSTOMER_INCLUDE = {
  customer: { select: { id: true, ledger: { select: { name: true } } } },
} as const;

const SALES_INVOICE_INCLUDE = {
  salesInvoice: { select: { id: true, invoiceNumber: true, invoiceDate: true } },
} as const;

const ITEM_INCLUDE = { items: true } as const;

type DebitNoteListRowRaw = Prisma.DebitNoteGetPayload<{
  include: typeof CUSTOMER_INCLUDE & typeof SALES_INVOICE_INCLUDE;
}>;
type DebitNoteDetailRaw = Prisma.DebitNoteGetPayload<{
  include: typeof CUSTOMER_INCLUDE & typeof SALES_INVOICE_INCLUDE & typeof ITEM_INCLUDE;
}>;

const DEBIT_NOTE_ITEM_DECIMAL_FIELDS = [
  "taxableAmount",
  "ratePercent",
  "cessPercent",
  "cgst",
  "sgst",
  "igst",
  "cess",
  "totalAmount",
] as const;

const DEBIT_NOTE_DECIMAL_FIELDS = ["taxableAmount", "totalCgst", "totalSgst", "totalIgst", "totalCess", "grandTotal"] as const;

function toDebitNoteListRow(raw: DebitNoteListRowRaw): DebitNoteListRow {
  const { customer, salesInvoice, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of DEBIT_NOTE_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  return {
    ...(normalizedHeader as unknown as DebitNoteListRow),
    customer: { id: customer.id, name: customer.ledger.name },
    salesInvoice,
  };
}

function toDebitNoteDetail(raw: DebitNoteDetailRaw): DebitNoteDetail {
  const { customer, salesInvoice, items, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of DEBIT_NOTE_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row
  // order (credit-note-repository.ts's identical note).
  const normalizedItems: DebitNoteItemDetail[] = items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => {
      const line: Record<string, unknown> = { ...item };
      for (const field of DEBIT_NOTE_ITEM_DECIMAL_FIELDS) {
        line[field] = (item as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
      }
      return line as unknown as DebitNoteItemDetail;
    });

  return {
    ...(normalizedHeader as unknown as DebitNoteDetail),
    customer: { id: customer.id, name: customer.ledger.name },
    salesInvoice,
    items: normalizedItems,
  };
}

function buildWhere(companyId: string, financialYearId: string, filters: DebitNoteListFilters): Prisma.DebitNoteWhereInput {
  const where: Prisma.DebitNoteWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.customerId) {
    where.customerId = filters.customerId;
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
      { customer: { ledger: { name: { contains: filters.search, mode: "insensitive" } } } },
      { salesInvoice: { invoiceNumber: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  return where;
}

export interface DebitNoteLinePersistData {
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

export interface DebitNoteHeaderPersistData {
  customerId: string;
  salesInvoiceId: string | null;
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

export interface SalesInvoiceForDebitNote {
  id: string;
  companyId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  status: string;
  customerMode: string;
  customerId: string | null;
  placeOfSupplyStateCode: string;
}

export const debitNoteRepository = {
  async findMany(companyId: string, financialYearId: string, filters: DebitNoteListFilters = {}): Promise<DebitNoteListRow[]> {
    const rows = await prisma.debitNote.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: { ...CUSTOMER_INCLUDE, ...SALES_INVOICE_INCLUDE },
      orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toDebitNoteListRow);
  },

  /** Infinite-scroll page for the Debit Notes list — same filters/ordering
   * as `findMany`, just `skip`/`take`-bounded. */
  async findManyPage(
    companyId: string,
    financialYearId: string,
    filters: DebitNoteListFilters,
    page: PageParams
  ): Promise<Page<DebitNoteListRow>> {
    const result = await fetchPage(
      (args) =>
        prisma.debitNote.findMany({
          where: buildWhere(companyId, financialYearId, filters),
          include: { ...CUSTOMER_INCLUDE, ...SALES_INVOICE_INCLUDE },
          orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
          ...args,
        }),
      page
    );
    return { items: result.items.map(toDebitNoteListRow), hasMore: result.hasMore };
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<DebitNoteDetail | null> {
    const row = await client.debitNote.findUnique({
      where: { id },
      include: { ...CUSTOMER_INCLUDE, ...SALES_INVOICE_INCLUDE, ...ITEM_INCLUDE },
    });
    return row ? toDebitNoteDetail(row) : null;
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: DebitNoteHeaderPersistData,
    lines: DebitNoteLinePersistData[],
    createdByUserId: string
  ): Promise<DebitNoteDetail> {
    const created = await tx.debitNote.create({
      data: {
        companyId,
        financialYearId,
        createdByUserId,
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...CUSTOMER_INCLUDE, ...SALES_INVOICE_INCLUDE, ...ITEM_INCLUDE },
    });
    return toDebitNoteDetail(created);
  },

  /** Delete-all-then-recreate the line set inside the caller's transaction —
   * mirrors credit-note-repository.ts's replaceItemsAndUpdate. `noteNumber`
   * is never touched here (only replaceItemsAndPost assigns it). */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly DebitNoteStatus[],
    header: DebitNoteHeaderPersistData,
    lines: DebitNoteLinePersistData[]
  ): Promise<DebitNoteDetail | null> {
    const existing = await tx.debitNote.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.debitNoteItem.deleteMany({ where: { debitNoteId: id } });
    const updated = await tx.debitNote.update({
      where: { id },
      data: {
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...CUSTOMER_INCLUDE, ...SALES_INVOICE_INCLUDE, ...ITEM_INCLUDE },
    });
    return toDebitNoteDetail(updated);
  },

  /** Posting's own write (41-debit-note.md's Posting steps combined):
   * replaces the line set with the freshly-recomputed persist data, updates
   * every header total plus `noteNumber`/`voucherId`, and flips `status` to
   * `POSTED` — all atomically, guarded by `WHERE status = 'DRAFT'` so a
   * concurrent status change loses cleanly. */
  async replaceItemsAndPost(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    header: DebitNoteHeaderPersistData,
    lines: DebitNoteLinePersistData[],
    generated: GeneratedNumber,
    voucherId: string
  ): Promise<DebitNoteDetail | null> {
    const existing = await tx.debitNote.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || existing.status !== "DRAFT") {
      return null;
    }

    await tx.debitNoteItem.deleteMany({ where: { debitNoteId: id } });
    const updated = await tx.debitNote.update({
      where: { id },
      data: {
        ...header,
        noteNumber: generated.formatted,
        voucherId,
        status: "POSTED",
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...CUSTOMER_INCLUDE, ...SALES_INVOICE_INCLUDE, ...ITEM_INCLUDE },
    });
    return toDebitNoteDetail(updated);
  },

  /** Guarded status transition — mirrors credit-note-repository.ts's
   * updateStatus exactly. Drives Cancel (`POSTED -> CANCELLED`) only. */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly DebitNoteStatus[],
    to: DebitNoteStatus
  ): Promise<number> {
    const result = await client.debitNote.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  /** Company-scoped lookup of the (optionally) linked source invoice — the
   * read create/update/post all use to validate the customer match, POSTED
   * status, and non-WALK_IN mode (41-debit-note.md's Business Rules). */
  async findSalesInvoiceForDebitNote(
    client: PrismaClientOrTransaction,
    companyId: string,
    salesInvoiceId: string
  ): Promise<SalesInvoiceForDebitNote | null> {
    const invoice = await client.salesInvoice.findUnique({
      where: { id: salesInvoiceId },
      select: {
        id: true,
        companyId: true,
        invoiceNumber: true,
        invoiceDate: true,
        status: true,
        customerMode: true,
        customerId: true,
        placeOfSupplyStateCode: true,
      },
    });
    if (!invoice || invoice.companyId !== companyId) {
      return null;
    }
    return invoice;
  },

  async findCustomerForDebitNote(
    client: PrismaClientOrTransaction,
    companyId: string,
    customerId: string
  ): Promise<{ id: string; companyId: string; isActive: boolean; ledgerId: string; name: string } | null> {
    const customer = await client.customer.findUnique({
      where: { id: customerId },
      select: { id: true, companyId: true, isActive: true, ledgerId: true, ledger: { select: { name: true } } },
    });
    if (!customer || customer.companyId !== companyId) {
      return null;
    }
    return { id: customer.id, companyId: customer.companyId, isActive: customer.isActive, ledgerId: customer.ledgerId, name: customer.ledger.name };
  },

  async findCompanyStateCode(companyId: string): Promise<string | null> {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { stateCode: true } });
    return company?.stateCode ?? null;
  },

  /** The optional invoice picker's search results — POSTED invoices with a
   * real customer only (a WALK_IN invoice is always rejected as a link
   * target, so it never appears in the picker at all). */
  async findPostedInvoicesForPicker(
    companyId: string,
    financialYearId: string,
    search?: string
  ): Promise<DebitNoteInvoiceOption[]> {
    const rows = await prisma.salesInvoice.findMany({
      where: {
        companyId,
        financialYearId,
        status: "POSTED",
        customerId: { not: null },
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { customer: { ledger: { name: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        placeOfSupplyStateCode: true,
        customerId: true,
        customer: { select: { ledger: { select: { name: true } } } },
      },
      orderBy: { invoiceDate: "desc" },
      take: 50,
    });
    return rows
      .filter((row): row is typeof row & { customerId: string; customer: NonNullable<(typeof row)["customer"]> } => row.customerId !== null && row.customer !== null)
      .map((row) => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        invoiceDate: row.invoiceDate,
        customerId: row.customerId,
        customerName: row.customer.ledger.name,
        placeOfSupplyStateCode: row.placeOfSupplyStateCode,
      }));
  },
};
