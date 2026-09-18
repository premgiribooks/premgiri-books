import { Prisma, type CreditNoteStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  CreditNoteDetail,
  CreditNoteInvoiceOption,
  CreditNoteItemDetail,
  CreditNoteListFilters,
  CreditNoteListRow,
} from "@/types/credit-note";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const CUSTOMER_INCLUDE = {
  customer: { select: { id: true, ledger: { select: { name: true } } } },
} as const;

const SALES_INVOICE_INCLUDE = {
  salesInvoice: { select: { id: true, invoiceNumber: true, invoiceDate: true } },
} as const;

const REFUND_LEDGER_INCLUDE = {
  refundLedger: { select: { id: true, name: true } },
  paymentMode: { select: { id: true, name: true } },
} as const;

const ITEM_INCLUDE = { items: true } as const;

type CreditNoteListRowRaw = Prisma.CreditNoteGetPayload<{
  include: typeof CUSTOMER_INCLUDE & typeof SALES_INVOICE_INCLUDE;
}>;
type CreditNoteDetailRaw = Prisma.CreditNoteGetPayload<{
  include: typeof CUSTOMER_INCLUDE & typeof SALES_INVOICE_INCLUDE & typeof REFUND_LEDGER_INCLUDE & typeof ITEM_INCLUDE;
}>;

const CREDIT_NOTE_ITEM_DECIMAL_FIELDS = [
  "taxableAmount",
  "ratePercent",
  "cessPercent",
  "cgst",
  "sgst",
  "igst",
  "cess",
  "totalAmount",
] as const;

const CREDIT_NOTE_DECIMAL_FIELDS = ["taxableAmount", "totalCgst", "totalSgst", "totalIgst", "totalCess", "grandTotal"] as const;

function toCreditNoteListRow(raw: CreditNoteListRowRaw): CreditNoteListRow {
  const { customer, salesInvoice, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of CREDIT_NOTE_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  return {
    ...(normalizedHeader as unknown as CreditNoteListRow),
    customer: { id: customer.id, name: customer.ledger.name },
    salesInvoice,
  };
}

function toCreditNoteDetail(raw: CreditNoteDetailRaw): CreditNoteDetail {
  const { customer, salesInvoice, refundLedger, paymentMode, items, ...header } = raw;
  const normalizedHeader: Record<string, unknown> = { ...header };
  for (const field of CREDIT_NOTE_DECIMAL_FIELDS) {
    normalizedHeader[field] = (header as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row
  // order (sales-return-repository.ts's identical note).
  const normalizedItems: CreditNoteItemDetail[] = items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => {
      const line: Record<string, unknown> = { ...item };
      for (const field of CREDIT_NOTE_ITEM_DECIMAL_FIELDS) {
        line[field] = (item as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
      }
      return line as unknown as CreditNoteItemDetail;
    });

  return {
    ...(normalizedHeader as unknown as CreditNoteDetail),
    customer: { id: customer.id, name: customer.ledger.name },
    salesInvoice,
    refundLedger,
    paymentMode,
    items: normalizedItems,
  };
}

function buildWhere(companyId: string, financialYearId: string, filters: CreditNoteListFilters): Prisma.CreditNoteWhereInput {
  const where: Prisma.CreditNoteWhereInput = { companyId, financialYearId };

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

export interface CreditNoteLinePersistData {
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

export interface CreditNoteHeaderPersistData {
  customerId: string;
  salesInvoiceId: string | null;
  noteDate: Date;
  placeOfSupplyStateCode: string;
  refundMode: "LEDGER_ADJUSTMENT" | "CASH_REFUND";
  refundLedgerId: string | null;
  paymentModeId: string | null;
  reason: string;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}

export interface SalesInvoiceForCreditNote {
  id: string;
  companyId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  status: string;
  customerMode: string;
  customerId: string | null;
  placeOfSupplyStateCode: string;
}

export const creditNoteRepository = {
  async findMany(companyId: string, financialYearId: string, filters: CreditNoteListFilters = {}): Promise<CreditNoteListRow[]> {
    const rows = await prisma.creditNote.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: { ...CUSTOMER_INCLUDE, ...SALES_INVOICE_INCLUDE },
      orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toCreditNoteListRow);
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<CreditNoteDetail | null> {
    const row = await client.creditNote.findUnique({
      where: { id },
      include: { ...CUSTOMER_INCLUDE, ...SALES_INVOICE_INCLUDE, ...REFUND_LEDGER_INCLUDE, ...ITEM_INCLUDE },
    });
    return row ? toCreditNoteDetail(row) : null;
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: CreditNoteHeaderPersistData,
    lines: CreditNoteLinePersistData[],
    createdByUserId: string
  ): Promise<CreditNoteDetail> {
    const created = await tx.creditNote.create({
      data: {
        companyId,
        financialYearId,
        createdByUserId,
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...CUSTOMER_INCLUDE, ...SALES_INVOICE_INCLUDE, ...REFUND_LEDGER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toCreditNoteDetail(created);
  },

  /** Delete-all-then-recreate the line set inside the caller's transaction —
   * mirrors sales-return-repository.ts's replaceItemsAndUpdate. `noteNumber`
   * is never touched here (only replaceItemsAndPost assigns it). */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly CreditNoteStatus[],
    header: CreditNoteHeaderPersistData,
    lines: CreditNoteLinePersistData[]
  ): Promise<CreditNoteDetail | null> {
    const existing = await tx.creditNote.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.creditNoteItem.deleteMany({ where: { creditNoteId: id } });
    const updated = await tx.creditNote.update({
      where: { id },
      data: {
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...CUSTOMER_INCLUDE, ...SALES_INVOICE_INCLUDE, ...REFUND_LEDGER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toCreditNoteDetail(updated);
  },

  /** Posting's own write (40-credit-note.md's Posting steps 3-5 combined):
   * replaces the line set with the freshly-recomputed persist data, updates
   * every header total plus `noteNumber`/`voucherId`, and flips `status` to
   * `POSTED` — all atomically, guarded by `WHERE status = 'DRAFT'` so a
   * concurrent status change loses cleanly. */
  async replaceItemsAndPost(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    header: CreditNoteHeaderPersistData,
    lines: CreditNoteLinePersistData[],
    generated: GeneratedNumber,
    voucherId: string
  ): Promise<CreditNoteDetail | null> {
    const existing = await tx.creditNote.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || existing.status !== "DRAFT") {
      return null;
    }

    await tx.creditNoteItem.deleteMany({ where: { creditNoteId: id } });
    const updated = await tx.creditNote.update({
      where: { id },
      data: {
        ...header,
        noteNumber: generated.formatted,
        voucherId,
        status: "POSTED",
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { ...CUSTOMER_INCLUDE, ...SALES_INVOICE_INCLUDE, ...REFUND_LEDGER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toCreditNoteDetail(updated);
  },

  /** Guarded status transition — mirrors sales-return-repository.ts's
   * updateStatus exactly. Drives Cancel (`POSTED -> CANCELLED`) only. */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly CreditNoteStatus[],
    to: CreditNoteStatus
  ): Promise<number> {
    const result = await client.creditNote.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  /** Company-scoped lookup of the (optionally) linked source invoice — the
   * read create/update/post all use to validate the customer match, POSTED
   * status, and non-WALK_IN mode (40-credit-note.md's Business Rules). */
  async findSalesInvoiceForCreditNote(
    client: PrismaClientOrTransaction,
    companyId: string,
    salesInvoiceId: string
  ): Promise<SalesInvoiceForCreditNote | null> {
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

  async findCustomerForCreditNote(
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

  async findRefundLedgerForCreditNote(
    client: PrismaClientOrTransaction,
    companyId: string,
    ledgerId: string
  ): Promise<{ id: string; companyId: string; isActive: boolean } | null> {
    const ledger = await client.ledger.findUnique({
      where: { id: ledgerId },
      select: { id: true, companyId: true, isActive: true },
    });
    if (!ledger || ledger.companyId !== companyId) {
      return null;
    }
    return ledger;
  },

  /** Any active company Ledger — the refund ledger picker's options, no new
   * Company Settings mapping needed (mirrors sales-return-repository.ts's
   * identical picker). */
  async findSelectableRefundLedgers(companyId: string): Promise<{ id: string; name: string; groupName: string }[]> {
    const ledgers = await prisma.ledger.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, ledgerGroup: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return ledgers.map((ledger) => ({ id: ledger.id, name: ledger.name, groupName: ledger.ledgerGroup.name }));
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
  ): Promise<CreditNoteInvoiceOption[]> {
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
