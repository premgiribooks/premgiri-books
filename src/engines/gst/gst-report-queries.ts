import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { GstSupplyLine } from "./gst-report-types";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const WALK_IN_PARTY_NAME = "Walk-in Customer";

function toNum(value: Prisma.Decimal): number {
  return value.toNumber();
}

interface OverridableTaxRow {
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  cess: Prisma.Decimal;
  isTaxOverridden: boolean;
  overriddenCgst: Prisma.Decimal | null;
  overriddenSgst: Prisma.Decimal | null;
  overriddenIgst: Prisma.Decimal | null;
  overriddenCess: Prisma.Decimal | null;
}

/**
 * Prefers the overridden tax figures over the system-computed ones when
 * `isTaxOverridden` is set — the overridden values are what was actually
 * posted to the ledger (57-gst-registers.md Business Rules). Only
 * SalesInvoiceItem/PurchaseInvoiceItem carry this override concept; every
 * other source table's tax columns are read as-is by their own mapper.
 */
function resolveOverridableTax(row: OverridableTaxRow): {
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
} {
  if (row.isTaxOverridden) {
    return {
      cgst: toNum(row.overriddenCgst ?? row.cgst),
      sgst: toNum(row.overriddenSgst ?? row.sgst),
      igst: toNum(row.overriddenIgst ?? row.igst),
      cess: toNum(row.overriddenCess ?? row.cess),
    };
  }
  return {
    cgst: toNum(row.cgst),
    sgst: toNum(row.sgst),
    igst: toNum(row.igst),
    cess: toNum(row.cess),
  };
}

interface ResolvedParty {
  partyId: string | null;
  partyName: string;
  partyGstin: string | null;
}

type CustomerRelation = { id: string; gstin: string | null; ledger: { name: string } } | null;

/**
 * PERMANENT and converted-QUICK invoices both have `customer` set, so
 * preferring it whenever present (rather than branching on `customerMode`
 * first) correctly resolves a QUICK invoice that auto-converted
 * mid-transaction without extra logic (57-gst-registers.md Business Rules).
 */
function resolveSalesParty(
  customerMode: "PERMANENT" | "QUICK" | "WALK_IN",
  customer: CustomerRelation,
  quickCustomerName: string | null,
  quickCustomerGstin: string | null
): ResolvedParty {
  if (customer) {
    return { partyId: customer.id, partyName: customer.ledger.name, partyGstin: customer.gstin };
  }
  if (customerMode === "WALK_IN") {
    return { partyId: null, partyName: WALK_IN_PARTY_NAME, partyGstin: null };
  }
  return { partyId: null, partyName: quickCustomerName ?? "", partyGstin: quickCustomerGstin };
}

type SupplierRelation = { id: string; gstin: string | null; ledger: { name: string } };

function resolveSupplierParty(supplier: SupplierRelation): ResolvedParty {
  return { partyId: supplier.id, partyName: supplier.ledger.name, partyGstin: supplier.gstin };
}

const SALES_INVOICE_ITEM_INCLUDE = {
  salesInvoice: {
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      placeOfSupplyStateCode: true,
      customerMode: true,
      quickCustomerName: true,
      quickCustomerGstin: true,
      customer: { select: { id: true, gstin: true, ledger: { select: { name: true } } } },
    },
  },
  product: { select: { id: true, hsnCode: { select: { code: true } } } },
} satisfies Prisma.SalesInvoiceItemInclude;

type SalesInvoiceItemRow = Prisma.SalesInvoiceItemGetPayload<{ include: typeof SALES_INVOICE_ITEM_INCLUDE }>;

function toSalesInvoiceLine(row: SalesInvoiceItemRow): GstSupplyLine {
  const tax = resolveOverridableTax(row);
  const party = resolveSalesParty(
    row.salesInvoice.customerMode,
    row.salesInvoice.customer,
    row.salesInvoice.quickCustomerName,
    row.salesInvoice.quickCustomerGstin
  );
  return {
    documentType: "SALES_INVOICE",
    documentId: row.salesInvoice.id,
    documentNumber: row.salesInvoice.invoiceNumber,
    documentDate: row.salesInvoice.invoiceDate,
    ...party,
    placeOfSupplyStateCode: row.salesInvoice.placeOfSupplyStateCode,
    hsnCode: row.product.hsnCode?.code ?? null,
    productId: row.productId,
    quantity: toNum(row.quantity),
    ratePercent: toNum(row.ratePercent),
    cessPercent: toNum(row.cessPercent),
    taxableAmount: toNum(row.taxableAmount),
    ...tax,
    totalAmount: toNum(row.totalAmount),
  };
}

const SALES_RETURN_ITEM_INCLUDE = {
  salesReturn: {
    select: {
      id: true,
      returnNumber: true,
      returnDate: true,
      salesInvoice: {
        select: {
          placeOfSupplyStateCode: true,
          customerMode: true,
          quickCustomerName: true,
          quickCustomerGstin: true,
          customer: { select: { id: true, gstin: true, ledger: { select: { name: true } } } },
        },
      },
    },
  },
  salesInvoiceItem: {
    select: {
      productId: true,
      ratePercent: true,
      cessPercent: true,
      product: { select: { hsnCode: { select: { code: true } } } },
    },
  },
} satisfies Prisma.SalesReturnItemInclude;

type SalesReturnItemRow = Prisma.SalesReturnItemGetPayload<{ include: typeof SALES_RETURN_ITEM_INCLUDE }>;

function toSalesReturnLine(row: SalesReturnItemRow): GstSupplyLine {
  const sourceInvoice = row.salesReturn.salesInvoice;
  const party = resolveSalesParty(
    sourceInvoice.customerMode,
    sourceInvoice.customer,
    sourceInvoice.quickCustomerName,
    sourceInvoice.quickCustomerGstin
  );
  return {
    documentType: "SALES_RETURN",
    documentId: row.salesReturn.id,
    documentNumber: row.salesReturn.returnNumber ?? "",
    documentDate: row.salesReturn.returnDate,
    ...party,
    // A return's place of supply is the PARENT INVOICE's, never the
    // reporting company's own state — 57-gst-registers.md Business Rules.
    placeOfSupplyStateCode: sourceInvoice.placeOfSupplyStateCode,
    hsnCode: row.salesInvoiceItem.product.hsnCode?.code ?? null,
    productId: row.salesInvoiceItem.productId,
    // Stored positive ("quantity returned"), like every other column on this
    // row — negated here for the same reason taxableAmount/cgst/etc. are: a
    // returned quantity must reduce, not inflate, a consumer's net total.
    quantity: -toNum(row.quantity),
    ratePercent: toNum(row.salesInvoiceItem.ratePercent),
    cessPercent: toNum(row.salesInvoiceItem.cessPercent),
    taxableAmount: -toNum(row.taxableAmount),
    cgst: -toNum(row.cgst),
    sgst: -toNum(row.sgst),
    igst: -toNum(row.igst),
    cess: -toNum(row.cess),
    totalAmount: -toNum(row.totalAmount),
  };
}

const CREDIT_NOTE_ITEM_INCLUDE = {
  creditNote: {
    select: {
      id: true,
      noteNumber: true,
      noteDate: true,
      placeOfSupplyStateCode: true,
      customer: { select: { id: true, gstin: true, ledger: { select: { name: true } } } },
    },
  },
} satisfies Prisma.CreditNoteItemInclude;

type CreditNoteItemRow = Prisma.CreditNoteItemGetPayload<{ include: typeof CREDIT_NOTE_ITEM_INCLUDE }>;

function toCreditNoteLine(row: CreditNoteItemRow): GstSupplyLine {
  const customer = row.creditNote.customer;
  return {
    documentType: "CREDIT_NOTE",
    documentId: row.creditNote.id,
    documentNumber: row.creditNote.noteNumber ?? "",
    documentDate: row.creditNote.noteDate,
    partyId: customer.id,
    partyName: customer.ledger.name,
    partyGstin: customer.gstin,
    placeOfSupplyStateCode: row.creditNote.placeOfSupplyStateCode,
    hsnCode: null,
    productId: null,
    quantity: null,
    ratePercent: toNum(row.ratePercent),
    cessPercent: toNum(row.cessPercent),
    taxableAmount: -toNum(row.taxableAmount),
    cgst: -toNum(row.cgst),
    sgst: -toNum(row.sgst),
    igst: -toNum(row.igst),
    cess: -toNum(row.cess),
    totalAmount: -toNum(row.totalAmount),
  };
}

const DEBIT_NOTE_ITEM_INCLUDE = {
  debitNote: {
    select: {
      id: true,
      noteNumber: true,
      noteDate: true,
      placeOfSupplyStateCode: true,
      customer: { select: { id: true, gstin: true, ledger: { select: { name: true } } } },
    },
  },
} satisfies Prisma.DebitNoteItemInclude;

type DebitNoteItemRow = Prisma.DebitNoteItemGetPayload<{ include: typeof DEBIT_NOTE_ITEM_INCLUDE }>;

function toDebitNoteLine(row: DebitNoteItemRow): GstSupplyLine {
  const customer = row.debitNote.customer;
  return {
    documentType: "DEBIT_NOTE",
    documentId: row.debitNote.id,
    documentNumber: row.debitNote.noteNumber ?? "",
    documentDate: row.debitNote.noteDate,
    partyId: customer.id,
    partyName: customer.ledger.name,
    partyGstin: customer.gstin,
    placeOfSupplyStateCode: row.debitNote.placeOfSupplyStateCode,
    hsnCode: null,
    productId: null,
    quantity: null,
    ratePercent: toNum(row.ratePercent),
    cessPercent: toNum(row.cessPercent),
    taxableAmount: toNum(row.taxableAmount),
    cgst: toNum(row.cgst),
    sgst: toNum(row.sgst),
    igst: toNum(row.igst),
    cess: toNum(row.cess),
    totalAmount: toNum(row.totalAmount),
  };
}

const PURCHASE_INVOICE_ITEM_INCLUDE = {
  purchaseInvoice: {
    select: {
      id: true,
      invoiceNumber: true,
      supplierInvoiceNumber: true,
      invoiceDate: true,
      placeOfSupplyStateCode: true,
      supplier: { select: { id: true, gstin: true, ledger: { select: { name: true } } } },
    },
  },
  product: { select: { id: true, hsnCode: { select: { code: true } } } },
} satisfies Prisma.PurchaseInvoiceItemInclude;

type PurchaseInvoiceItemRow = Prisma.PurchaseInvoiceItemGetPayload<{ include: typeof PURCHASE_INVOICE_ITEM_INCLUDE }>;

function toPurchaseInvoiceLine(row: PurchaseInvoiceItemRow): GstSupplyLine {
  const tax = resolveOverridableTax(row);
  const party = resolveSupplierParty(row.purchaseInvoice.supplier);
  return {
    documentType: "PURCHASE_INVOICE",
    documentId: row.purchaseInvoice.id,
    documentNumber: row.purchaseInvoice.invoiceNumber ?? row.purchaseInvoice.supplierInvoiceNumber,
    documentDate: row.purchaseInvoice.invoiceDate,
    ...party,
    placeOfSupplyStateCode: row.purchaseInvoice.placeOfSupplyStateCode,
    hsnCode: row.product.hsnCode?.code ?? null,
    productId: row.productId,
    quantity: toNum(row.quantity),
    ratePercent: toNum(row.ratePercent),
    cessPercent: toNum(row.cessPercent),
    taxableAmount: toNum(row.taxableAmount),
    ...tax,
    totalAmount: toNum(row.totalAmount),
  };
}

const PURCHASE_RETURN_ITEM_INCLUDE = {
  purchaseReturn: {
    select: {
      id: true,
      returnNumber: true,
      returnDate: true,
      purchaseInvoice: {
        select: {
          placeOfSupplyStateCode: true,
          supplier: { select: { id: true, gstin: true, ledger: { select: { name: true } } } },
        },
      },
    },
  },
  purchaseInvoiceItem: {
    select: {
      productId: true,
      ratePercent: true,
      cessPercent: true,
      product: { select: { hsnCode: { select: { code: true } } } },
    },
  },
} satisfies Prisma.PurchaseReturnItemInclude;

type PurchaseReturnItemRow = Prisma.PurchaseReturnItemGetPayload<{ include: typeof PURCHASE_RETURN_ITEM_INCLUDE }>;

function toPurchaseReturnLine(row: PurchaseReturnItemRow): GstSupplyLine {
  const sourceInvoice = row.purchaseReturn.purchaseInvoice;
  const party = resolveSupplierParty(sourceInvoice.supplier);
  return {
    documentType: "PURCHASE_RETURN",
    documentId: row.purchaseReturn.id,
    documentNumber: row.purchaseReturn.returnNumber ?? "",
    documentDate: row.purchaseReturn.returnDate,
    ...party,
    // Mirrors Sales Return: place of supply comes from the PARENT invoice.
    placeOfSupplyStateCode: sourceInvoice.placeOfSupplyStateCode,
    hsnCode: row.purchaseInvoiceItem.product.hsnCode?.code ?? null,
    productId: row.purchaseInvoiceItem.productId,
    // See toSalesReturnLine's comment — quantity is stored positive and must
    // be negated here too, mirroring every monetary field on this line.
    quantity: -toNum(row.quantity),
    ratePercent: toNum(row.purchaseInvoiceItem.ratePercent),
    cessPercent: toNum(row.purchaseInvoiceItem.cessPercent),
    taxableAmount: -toNum(row.taxableAmount),
    cgst: -toNum(row.cgst),
    sgst: -toNum(row.sgst),
    igst: -toNum(row.igst),
    cess: -toNum(row.cess),
    totalAmount: -toNum(row.totalAmount),
  };
}

function byDocumentDateAscending(a: GstSupplyLine, b: GstSupplyLine): number {
  return a.documentDate.getTime() - b.documentDate.getTime();
}

/**
 * The outward supply register: Sales Invoice (+), Sales Return (-), Credit
 * Note (-), and Debit Note (+) lines for `companyId` within `[from, to]`
 * (inclusive), `POSTED` documents only. Pure read-only aggregation — no
 * permission check (engine convention, callers gate) and no GST arithmetic
 * (every figure is read verbatim from an already-posted column).
 */
export async function getOutwardSupplyLines(
  companyId: string,
  from: Date,
  to: Date,
  tx?: PrismaClientOrTransaction
): Promise<GstSupplyLine[]> {
  const client = tx ?? prisma;

  const [salesInvoiceItems, salesReturnItems, creditNoteItems, debitNoteItems] = await Promise.all([
    client.salesInvoiceItem.findMany({
      where: { salesInvoice: { companyId, status: "POSTED", invoiceDate: { gte: from, lte: to } } },
      include: SALES_INVOICE_ITEM_INCLUDE,
    }),
    client.salesReturnItem.findMany({
      where: { salesReturn: { companyId, status: "POSTED", returnDate: { gte: from, lte: to } } },
      include: SALES_RETURN_ITEM_INCLUDE,
    }),
    client.creditNoteItem.findMany({
      where: { creditNote: { companyId, status: "POSTED", noteDate: { gte: from, lte: to } } },
      include: CREDIT_NOTE_ITEM_INCLUDE,
    }),
    client.debitNoteItem.findMany({
      where: { debitNote: { companyId, status: "POSTED", noteDate: { gte: from, lte: to } } },
      include: DEBIT_NOTE_ITEM_INCLUDE,
    }),
  ]);

  return [
    ...salesInvoiceItems.map(toSalesInvoiceLine),
    ...salesReturnItems.map(toSalesReturnLine),
    ...creditNoteItems.map(toCreditNoteLine),
    ...debitNoteItems.map(toDebitNoteLine),
  ].sort(byDocumentDateAscending);
}

/**
 * The inward supply register: Purchase Invoice (+) and Purchase Return (-)
 * lines for `companyId` within `[from, to]` (inclusive), `POSTED` documents
 * only. Mirrors getOutwardSupplyLines exactly.
 */
export async function getInwardSupplyLines(
  companyId: string,
  from: Date,
  to: Date,
  tx?: PrismaClientOrTransaction
): Promise<GstSupplyLine[]> {
  const client = tx ?? prisma;

  const [purchaseInvoiceItems, purchaseReturnItems] = await Promise.all([
    client.purchaseInvoiceItem.findMany({
      where: { purchaseInvoice: { companyId, status: "POSTED", invoiceDate: { gte: from, lte: to } } },
      include: PURCHASE_INVOICE_ITEM_INCLUDE,
    }),
    client.purchaseReturnItem.findMany({
      where: { purchaseReturn: { companyId, status: "POSTED", returnDate: { gte: from, lte: to } } },
      include: PURCHASE_RETURN_ITEM_INCLUDE,
    }),
  ]);

  return [...purchaseInvoiceItems.map(toPurchaseInvoiceLine), ...purchaseReturnItems.map(toPurchaseReturnLine)].sort(
    byDocumentDateAscending
  );
}
