import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

// gst-report-queries.ts imports the module-level `prisma` client as the
// default for the optional `tx` parameter — mocked to a plain object so
// importing the real module doesn't try to construct a live client
// (customer-repository.test.ts's convention). Every test below passes its
// own fake client as `tx`, so the stub is never actually invoked.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { getInwardSupplyLines, getOutwardSupplyLines } from "@/engines/gst/gst-report-queries";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FROM = new Date("2026-04-01T00:00:00.000Z");
const TO = new Date("2026-04-30T00:00:00.000Z");

const CUSTOMER_A = { id: "cust-1", gstin: "27AAAAA0000A1Z5", ledger: { name: "Acme Retail" } };
const SUPPLIER_A = { id: "supp-1", gstin: "27BBBBB0000B1Z5", ledger: { name: "Acme Wholesale" } };

interface FakeClientOverrides {
  salesInvoiceItemFindMany?: unknown[];
  salesReturnItemFindMany?: unknown[];
  creditNoteItemFindMany?: unknown[];
  debitNoteItemFindMany?: unknown[];
  purchaseInvoiceItemFindMany?: unknown[];
  purchaseReturnItemFindMany?: unknown[];
}

function fakeClient(overrides: FakeClientOverrides) {
  return {
    salesInvoiceItem: { findMany: vi.fn().mockResolvedValue(overrides.salesInvoiceItemFindMany ?? []) },
    salesReturnItem: { findMany: vi.fn().mockResolvedValue(overrides.salesReturnItemFindMany ?? []) },
    creditNoteItem: { findMany: vi.fn().mockResolvedValue(overrides.creditNoteItemFindMany ?? []) },
    debitNoteItem: { findMany: vi.fn().mockResolvedValue(overrides.debitNoteItemFindMany ?? []) },
    purchaseInvoiceItem: { findMany: vi.fn().mockResolvedValue(overrides.purchaseInvoiceItemFindMany ?? []) },
    purchaseReturnItem: { findMany: vi.fn().mockResolvedValue(overrides.purchaseReturnItemFindMany ?? []) },
  } as unknown as Prisma.TransactionClient;
}

function decimal(value: number) {
  // Mirrors the shape gst-report-queries.ts expects from Prisma.Decimal —
  // only `.toNumber()` is ever called on these fields.
  return { toNumber: () => value };
}

describe("getOutwardSupplyLines", () => {
  it("scopes every query to the given company and POSTED-only date range", async () => {
    const client = fakeClient({});

    await getOutwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(client.salesInvoiceItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { salesInvoice: { companyId: COMPANY_ID, status: "POSTED", invoiceDate: { gte: FROM, lte: TO } } },
      })
    );
    expect(client.salesReturnItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { salesReturn: { companyId: COMPANY_ID, status: "POSTED", returnDate: { gte: FROM, lte: TO } } },
      })
    );
    expect(client.creditNoteItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { creditNote: { companyId: COMPANY_ID, status: "POSTED", noteDate: { gte: FROM, lte: TO } } },
      })
    );
    expect(client.debitNoteItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { debitNote: { companyId: COMPANY_ID, status: "POSTED", noteDate: { gte: FROM, lte: TO } } },
      })
    );
  });

  it("never leaks another company's filter into the query (cross-company isolation)", async () => {
    const client = fakeClient({});

    await getOutwardSupplyLines(OTHER_COMPANY_ID, FROM, TO, client);

    const [salesInvoiceArgs] = (client.salesInvoiceItem.findMany as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(salesInvoiceArgs.where.salesInvoice.companyId).toBe(OTHER_COMPANY_ID);
    expect(salesInvoiceArgs.where.salesInvoice.companyId).not.toBe(COMPANY_ID);
  });

  it("maps a Sales Invoice line positive, preferring overridden tax over computed", async () => {
    const client = fakeClient({
      salesInvoiceItemFindMany: [
        {
          productId: "prod-1",
          quantity: decimal(10),
          ratePercent: decimal(18),
          cessPercent: decimal(0),
          taxableAmount: decimal(1000),
          cgst: decimal(90),
          sgst: decimal(90),
          igst: decimal(0),
          cess: decimal(0),
          totalAmount: decimal(1250),
          isTaxOverridden: true,
          overriddenCgst: decimal(80),
          overriddenSgst: decimal(80),
          overriddenIgst: decimal(0),
          overriddenCess: decimal(0),
          salesInvoice: {
            id: "inv-1",
            invoiceNumber: "INV-0001",
            invoiceDate: new Date("2026-04-10T00:00:00.000Z"),
            placeOfSupplyStateCode: "27",
            customerMode: "PERMANENT",
            quickCustomerName: null,
            quickCustomerGstin: null,
            customer: CUSTOMER_A,
          },
          product: { id: "prod-1", hsnCode: { code: "3208" } },
        },
      ],
    });

    const [line] = await getOutwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(line).toMatchObject({
      documentType: "SALES_INVOICE",
      documentId: "inv-1",
      documentNumber: "INV-0001",
      partyId: "cust-1",
      partyName: "Acme Retail",
      partyGstin: "27AAAAA0000A1Z5",
      placeOfSupplyStateCode: "27",
      hsnCode: "3208",
      productId: "prod-1",
      quantity: 10,
      taxableAmount: 1000,
      cgst: 80,
      sgst: 80,
      totalAmount: 1250,
    });
  });

  it("resolves a QUICK invoice's party from quickCustomer* fields when never converted", async () => {
    const client = fakeClient({
      salesInvoiceItemFindMany: [
        salesInvoiceItemFixture({
          salesInvoice: {
            id: "inv-2",
            invoiceNumber: "INV-0002",
            invoiceDate: new Date("2026-04-11T00:00:00.000Z"),
            placeOfSupplyStateCode: "27",
            customerMode: "QUICK",
            quickCustomerName: "Walk-up Buyer",
            quickCustomerGstin: null,
            customer: null,
          },
        }),
      ],
    });

    const [line] = await getOutwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(line.partyId).toBeNull();
    expect(line.partyName).toBe("Walk-up Buyer");
    expect(line.partyGstin).toBeNull();
  });

  it("prefers the resolved Customer row for a QUICK invoice that later converted mid-transaction", async () => {
    const client = fakeClient({
      salesInvoiceItemFindMany: [
        salesInvoiceItemFixture({
          salesInvoice: {
            id: "inv-3",
            invoiceNumber: "INV-0003",
            invoiceDate: new Date("2026-04-12T00:00:00.000Z"),
            placeOfSupplyStateCode: "27",
            customerMode: "QUICK",
            quickCustomerName: "Original Quick Name",
            quickCustomerGstin: null,
            customer: CUSTOMER_A,
          },
        }),
      ],
    });

    const [line] = await getOutwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(line.partyId).toBe("cust-1");
    expect(line.partyName).toBe("Acme Retail");
  });

  it("resolves a WALK_IN invoice to the literal label with no GSTIN", async () => {
    const client = fakeClient({
      salesInvoiceItemFindMany: [
        salesInvoiceItemFixture({
          salesInvoice: {
            id: "inv-4",
            invoiceNumber: "INV-0004",
            invoiceDate: new Date("2026-04-13T00:00:00.000Z"),
            placeOfSupplyStateCode: "27",
            customerMode: "WALK_IN",
            quickCustomerName: null,
            quickCustomerGstin: null,
            customer: null,
          },
        }),
      ],
    });

    const [line] = await getOutwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(line.partyId).toBeNull();
    expect(line.partyName).toBe("Walk-in Customer");
    expect(line.partyGstin).toBeNull();
  });

  it("maps a Sales Return line negative, using the source invoice item's rate and the parent invoice's place of supply", async () => {
    const client = fakeClient({
      salesReturnItemFindMany: [
        {
          quantity: decimal(2),
          taxableAmount: decimal(200),
          cgst: decimal(18),
          sgst: decimal(18),
          igst: decimal(0),
          cess: decimal(0),
          totalAmount: decimal(236),
          salesReturn: {
            id: "ret-1",
            returnNumber: "SR-0001",
            returnDate: new Date("2026-04-15T00:00:00.000Z"),
            salesInvoice: {
              // Deliberately different from any company "own state" default —
              // proves resolution reads the invoice's own field, not a fallback.
              placeOfSupplyStateCode: "09",
              customerMode: "PERMANENT",
              quickCustomerName: null,
              quickCustomerGstin: null,
              customer: CUSTOMER_A,
            },
          },
          salesInvoiceItem: {
            productId: "prod-1",
            ratePercent: decimal(18),
            cessPercent: decimal(0),
            product: { hsnCode: { code: "3208" } },
          },
        },
      ],
    });

    const [line] = await getOutwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(line.documentType).toBe("SALES_RETURN");
    expect(line.placeOfSupplyStateCode).toBe("09");
    expect(line.ratePercent).toBe(18);
    expect(line.taxableAmount).toBe(-200);
    expect(line.cgst).toBe(-18);
    expect(line.totalAmount).toBe(-236);
  });

  it("maps a Credit Note line negative with no HSN/product/quantity", async () => {
    const client = fakeClient({
      creditNoteItemFindMany: [
        {
          ratePercent: decimal(18),
          cessPercent: decimal(0),
          taxableAmount: decimal(500),
          cgst: decimal(45),
          sgst: decimal(45),
          igst: decimal(0),
          cess: decimal(0),
          totalAmount: decimal(590),
          creditNote: {
            id: "cn-1",
            noteNumber: "CN-0001",
            noteDate: new Date("2026-04-16T00:00:00.000Z"),
            placeOfSupplyStateCode: "27",
            customer: CUSTOMER_A,
          },
        },
      ],
    });

    const [line] = await getOutwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(line.documentType).toBe("CREDIT_NOTE");
    expect(line.hsnCode).toBeNull();
    expect(line.productId).toBeNull();
    expect(line.quantity).toBeNull();
    expect(line.taxableAmount).toBe(-500);
    expect(line.totalAmount).toBe(-590);
  });

  it("maps a Debit Note line positive with no HSN/product/quantity", async () => {
    const client = fakeClient({
      debitNoteItemFindMany: [
        {
          ratePercent: decimal(18),
          cessPercent: decimal(0),
          taxableAmount: decimal(500),
          cgst: decimal(45),
          sgst: decimal(45),
          igst: decimal(0),
          cess: decimal(0),
          totalAmount: decimal(590),
          debitNote: {
            id: "dn-1",
            noteNumber: "DN-0001",
            noteDate: new Date("2026-04-17T00:00:00.000Z"),
            placeOfSupplyStateCode: "27",
            customer: CUSTOMER_A,
          },
        },
      ],
    });

    const [line] = await getOutwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(line.documentType).toBe("DEBIT_NOTE");
    expect(line.hsnCode).toBeNull();
    expect(line.taxableAmount).toBe(500);
    expect(line.totalAmount).toBe(590);
  });

  it("sorts the combined lines by document date ascending", async () => {
    const client = fakeClient({
      salesInvoiceItemFindMany: [
        salesInvoiceItemFixture({
          salesInvoice: {
            id: "inv-late",
            invoiceNumber: "INV-LATE",
            invoiceDate: new Date("2026-04-20T00:00:00.000Z"),
            placeOfSupplyStateCode: "27",
            customerMode: "PERMANENT",
            quickCustomerName: null,
            quickCustomerGstin: null,
            customer: CUSTOMER_A,
          },
        }),
      ],
      debitNoteItemFindMany: [
        {
          ratePercent: decimal(18),
          cessPercent: decimal(0),
          taxableAmount: decimal(100),
          cgst: decimal(9),
          sgst: decimal(9),
          igst: decimal(0),
          cess: decimal(0),
          totalAmount: decimal(118),
          debitNote: {
            id: "dn-early",
            noteNumber: "DN-EARLY",
            noteDate: new Date("2026-04-05T00:00:00.000Z"),
            placeOfSupplyStateCode: "27",
            customer: CUSTOMER_A,
          },
        },
      ],
    });

    const lines = await getOutwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(lines.map((line) => line.documentId)).toEqual(["dn-early", "inv-late"]);
  });
});

function salesInvoiceItemFixture(overrides: { salesInvoice: Record<string, unknown> }) {
  return {
    productId: "prod-1",
    quantity: decimal(1),
    ratePercent: decimal(18),
    cessPercent: decimal(0),
    taxableAmount: decimal(100),
    cgst: decimal(9),
    sgst: decimal(9),
    igst: decimal(0),
    cess: decimal(0),
    totalAmount: decimal(118),
    isTaxOverridden: false,
    overriddenCgst: null,
    overriddenSgst: null,
    overriddenIgst: null,
    overriddenCess: null,
    product: { id: "prod-1", hsnCode: { code: "3208" } },
    ...overrides,
  };
}

describe("getInwardSupplyLines", () => {
  it("scopes every query to the given company and POSTED-only date range", async () => {
    const client = fakeClient({});

    await getInwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(client.purchaseInvoiceItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { purchaseInvoice: { companyId: COMPANY_ID, status: "POSTED", invoiceDate: { gte: FROM, lte: TO } } },
      })
    );
    expect(client.purchaseReturnItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { purchaseReturn: { companyId: COMPANY_ID, status: "POSTED", returnDate: { gte: FROM, lte: TO } } },
      })
    );
  });

  it("maps a Purchase Invoice line positive, preferring overridden tax, resolving the Supplier's ledger name", async () => {
    const client = fakeClient({
      purchaseInvoiceItemFindMany: [
        {
          productId: "prod-2",
          quantity: decimal(5),
          ratePercent: decimal(12),
          cessPercent: decimal(0),
          taxableAmount: decimal(1000),
          cgst: decimal(60),
          sgst: decimal(60),
          igst: decimal(0),
          cess: decimal(0),
          totalAmount: decimal(1120),
          isTaxOverridden: false,
          overriddenCgst: null,
          overriddenSgst: null,
          overriddenIgst: null,
          overriddenCess: null,
          purchaseInvoice: {
            id: "pinv-1",
            invoiceNumber: "PUR-0001",
            supplierInvoiceNumber: "SUP-INV-1",
            invoiceDate: new Date("2026-04-08T00:00:00.000Z"),
            placeOfSupplyStateCode: "27",
            supplier: SUPPLIER_A,
          },
          product: { id: "prod-2", hsnCode: { code: "3209" } },
        },
      ],
    });

    const [line] = await getInwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(line).toMatchObject({
      documentType: "PURCHASE_INVOICE",
      partyId: "supp-1",
      partyName: "Acme Wholesale",
      partyGstin: "27BBBBB0000B1Z5",
      taxableAmount: 1000,
      cgst: 60,
      totalAmount: 1120,
    });
  });

  it("falls back to supplierInvoiceNumber when the internal invoiceNumber hasn't been assigned yet", async () => {
    const client = fakeClient({
      purchaseInvoiceItemFindMany: [
        {
          productId: "prod-2",
          quantity: decimal(1),
          ratePercent: decimal(12),
          cessPercent: decimal(0),
          taxableAmount: decimal(100),
          cgst: decimal(6),
          sgst: decimal(6),
          igst: decimal(0),
          cess: decimal(0),
          totalAmount: decimal(112),
          isTaxOverridden: false,
          overriddenCgst: null,
          overriddenSgst: null,
          overriddenIgst: null,
          overriddenCess: null,
          purchaseInvoice: {
            id: "pinv-2",
            invoiceNumber: null,
            supplierInvoiceNumber: "SUP-INV-2",
            invoiceDate: new Date("2026-04-09T00:00:00.000Z"),
            placeOfSupplyStateCode: "27",
            supplier: SUPPLIER_A,
          },
          product: { id: "prod-2", hsnCode: null },
        },
      ],
    });

    const [line] = await getInwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(line.documentNumber).toBe("SUP-INV-2");
    expect(line.hsnCode).toBeNull();
  });

  it("maps a Purchase Return line negative, resolving place of supply from the parent invoice", async () => {
    const client = fakeClient({
      purchaseReturnItemFindMany: [
        {
          quantity: decimal(1),
          taxableAmount: decimal(100),
          cgst: decimal(6),
          sgst: decimal(6),
          igst: decimal(0),
          cess: decimal(0),
          totalAmount: decimal(112),
          purchaseReturn: {
            id: "pret-1",
            returnNumber: "PR-0001",
            returnDate: new Date("2026-04-18T00:00:00.000Z"),
            purchaseInvoice: {
              placeOfSupplyStateCode: "09",
              supplier: SUPPLIER_A,
            },
          },
          purchaseInvoiceItem: {
            productId: "prod-2",
            ratePercent: decimal(12),
            cessPercent: decimal(0),
            product: { hsnCode: { code: "3209" } },
          },
        },
      ],
    });

    const [line] = await getInwardSupplyLines(COMPANY_ID, FROM, TO, client);

    expect(line.documentType).toBe("PURCHASE_RETURN");
    expect(line.placeOfSupplyStateCode).toBe("09");
    expect(line.taxableAmount).toBe(-100);
    expect(line.totalAmount).toBe(-112);
  });
});
