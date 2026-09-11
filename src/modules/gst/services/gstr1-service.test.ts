import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getOutwardSupplyLinesMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  findOneMock,
  findByIdMock,
  upsertMock,
} = vi.hoisted(() => ({
  getOutwardSupplyLinesMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  findOneMock: vi.fn(),
  findByIdMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/engines/gst/gst-engine", () => ({
  gstReportEngine: { getOutwardSupplyLines: getOutwardSupplyLinesMock },
}));
vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/modules/gst/repositories/gst-filing-repository", () => ({
  gstFilingRepository: { findOne: findOneMock, findById: findByIdMock, upsert: upsertMock },
}));

import { gstr1Service } from "@/modules/gst/services/gstr1-service";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const FROM = new Date("2026-04-01T00:00:00.000Z");
const TO = new Date("2026-04-30T00:00:00.000Z");

function salesInvoiceLine(overrides: Partial<GstSupplyLine>): GstSupplyLine {
  return {
    documentType: "SALES_INVOICE",
    documentId: "inv-1",
    documentNumber: "INV-0001",
    documentDate: new Date("2026-04-05T00:00:00.000Z"),
    partyId: "party-1",
    partyName: "Acme",
    partyGstin: null,
    placeOfSupplyStateCode: "27",
    hsnCode: "3208",
    productId: "prod-1",
    quantity: 1,
    ratePercent: 18,
    cessPercent: 0,
    taxableAmount: 1000,
    cgst: 0,
    sgst: 0,
    igst: 180,
    cess: 0,
    totalAmount: 1180,
    ...overrides,
  };
}

beforeEach(() => {
  getOutwardSupplyLinesMock.mockReset();
  getCurrentFinancialYearMock.mockReset().mockResolvedValue({ id: FY_ID });
  getCurrentCompanyUserMock.mockReset().mockResolvedValue({ id: "u1", companyId: COMPANY_ID, role: "Company Admin" });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
  findOneMock.mockReset();
  findByIdMock.mockReset();
  upsertMock.mockReset();
});

describe("gstr1Service.getGstr1Return — B2B/B2C classification matrix", () => {
  it("classifies a line with a GSTIN present as B2B regardless of customerMode (PERMANENT)", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([salesInvoiceLine({ partyGstin: "27AAAAA0000A1Z5", igst: 0, cgst: 90, sgst: 90 })]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    expect(result.b2b).toHaveLength(1);
    expect(result.b2cLarge).toHaveLength(0);
    expect(result.b2cSmall).toHaveLength(0);
  });

  it("classifies a mid-transaction-converted QUICK invoice's now-resolved GSTIN as B2B", async () => {
    // getOutwardSupplyLines already resolves the converted Customer's GSTIN
    // onto the line (57-gst-registers.md) — this service only reads
    // partyGstin, never customerMode, so the conversion is transparent here.
    getOutwardSupplyLinesMock.mockResolvedValue([salesInvoiceLine({ partyGstin: "27BBBBB0000B1Z5", igst: 0, cgst: 90, sgst: 90 })]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    expect(result.b2b).toHaveLength(1);
  });

  it("classifies a WALK_IN / no-GSTIN line as unregistered (B2C), never B2B", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      salesInvoiceLine({ partyGstin: null, igst: 0, cgst: 90, sgst: 90, totalAmount: 1180 }),
    ]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    expect(result.b2b).toHaveLength(0);
    expect(result.b2cSmall.length + result.b2cLarge.length).toBeGreaterThan(0);
  });
});

describe("gstr1Service.getGstr1Return — B2C Large threshold boundary", () => {
  function interStateLine(totalAmount: number) {
    return salesInvoiceLine({
      documentId: "inv-large",
      partyGstin: null,
      igst: totalAmount * 0.18 * (1 / 1.18),
      cgst: 0,
      sgst: 0,
      taxableAmount: totalAmount / 1.18,
      totalAmount,
    });
  }

  it("classifies an inter-state invoice just above ₹2,50,000 as B2C Large", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([interStateLine(250000.01)]);
    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });
    expect(result.b2cLarge).toHaveLength(1);
    expect(result.b2cSmall).toHaveLength(0);
  });

  it("classifies an inter-state invoice exactly at ₹2,50,000 as B2C Small (strictly greater-than required)", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([interStateLine(250000)]);
    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });
    expect(result.b2cLarge).toHaveLength(0);
    expect(result.b2cSmall.length).toBeGreaterThan(0);
  });

  it("classifies an inter-state invoice just below ₹2,50,000 as B2C Small", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([interStateLine(249999.99)]);
    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });
    expect(result.b2cLarge).toHaveLength(0);
    expect(result.b2cSmall.length).toBeGreaterThan(0);
  });

  it("excludes an intra-state invoice from B2C Large regardless of value", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      salesInvoiceLine({
        documentId: "inv-huge-intra",
        partyGstin: null,
        igst: 0,
        cgst: 300000,
        sgst: 300000,
        taxableAmount: 3000000,
        totalAmount: 3600000,
      }),
    ]);
    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });
    expect(result.b2cLarge).toHaveLength(0);
    expect(result.b2cSmall.length).toBeGreaterThan(0);
  });
});

describe("gstr1Service.getGstr1Return — B2C Small consolidation", () => {
  it("consolidates unregistered lines by (placeOfSupplyStateCode, ratePercent), summing amounts", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      salesInvoiceLine({
        documentId: "a",
        partyGstin: null,
        placeOfSupplyStateCode: "27",
        ratePercent: 18,
        igst: 0,
        cgst: 90,
        sgst: 90,
        taxableAmount: 1000,
        totalAmount: 1180,
      }),
      salesInvoiceLine({
        documentId: "b",
        partyGstin: null,
        placeOfSupplyStateCode: "27",
        ratePercent: 18,
        igst: 0,
        cgst: 45,
        sgst: 45,
        taxableAmount: 500,
        totalAmount: 590,
      }),
      salesInvoiceLine({
        documentId: "c",
        partyGstin: null,
        placeOfSupplyStateCode: "29",
        ratePercent: 18,
        igst: 0,
        cgst: 18,
        sgst: 18,
        taxableAmount: 200,
        totalAmount: 236,
      }),
    ]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    expect(result.b2cSmall).toHaveLength(2);
    const maharashtraGroup = result.b2cSmall.find((group) => group.placeOfSupplyStateCode === "27");
    expect(maharashtraGroup?.taxableAmount).toBe(1500);
    expect(maharashtraGroup?.cgst).toBe(135);
  });
});

describe("gstr1Service.getGstr1Return — Nil-rated exclusion", () => {
  it("routes a zero-rate line to Table 8 only, never counted in Table 7's totals", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      salesInvoiceLine({
        documentId: "nil-1",
        partyGstin: null,
        ratePercent: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        taxableAmount: 500,
        totalAmount: 500,
      }),
    ]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    expect(result.nilRated).toHaveLength(1);
    expect(result.nilRated[0].taxableAmount).toBe(500);
    expect(result.b2cSmall).toHaveLength(0);
    expect(result.b2b).toHaveLength(0);
  });

  it("routes a zero-rate line to Table 8 even when the party has a GSTIN (never Table 4)", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      salesInvoiceLine({
        documentId: "nil-2",
        partyGstin: "27AAAAA0000A1Z5",
        ratePercent: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        taxableAmount: 500,
        totalAmount: 500,
      }),
    ]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    expect(result.nilRated).toHaveLength(1);
    expect(result.b2b).toHaveLength(0);
  });
});

describe("gstr1Service.getGstr1Return — Credit/Debit Notes and Sales Return exclusion", () => {
  function noteLine(overrides: Partial<GstSupplyLine>): GstSupplyLine {
    return {
      documentType: "CREDIT_NOTE",
      documentId: "cn-1",
      documentNumber: "CN-0001",
      documentDate: new Date("2026-04-10T00:00:00.000Z"),
      partyId: "party-1",
      partyName: "Acme",
      partyGstin: null,
      placeOfSupplyStateCode: "27",
      hsnCode: null,
      productId: null,
      quantity: null,
      ratePercent: 18,
      cessPercent: 0,
      taxableAmount: -500,
      cgst: -45,
      sgst: -45,
      igst: 0,
      cess: 0,
      totalAmount: -590,
      ...overrides,
    };
  }

  it("splits Credit Note lines into registered (invoice-wise) vs. unregistered (consolidated)", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      noteLine({ documentId: "cn-reg", partyGstin: "27AAAAA0000A1Z5" }),
      noteLine({ documentId: "cn-unreg", partyGstin: null }),
    ]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    expect(result.creditDebitNotesRegistered).toHaveLength(1);
    expect(result.creditDebitNotesRegistered[0].documentId).toBe("cn-reg");
    expect(result.creditDebitNotesUnregistered).toHaveLength(1);
  });

  it("includes a Debit Note under the note tables, not under Table 4 (B2B)", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      noteLine({
        documentType: "DEBIT_NOTE",
        documentId: "dn-1",
        partyGstin: "27AAAAA0000A1Z5",
        taxableAmount: 500,
        cgst: 45,
        sgst: 45,
        totalAmount: 590,
      }),
    ]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    expect(result.creditDebitNotesRegistered).toHaveLength(1);
    expect(result.b2b).toHaveLength(0);
  });

  it("never classifies a Sales Return line into either Credit/Debit Note table", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      {
        documentType: "SALES_RETURN",
        documentId: "sr-1",
        documentNumber: "SR-0001",
        documentDate: new Date("2026-04-12T00:00:00.000Z"),
        partyId: "party-1",
        partyName: "Acme",
        partyGstin: "27AAAAA0000A1Z5",
        placeOfSupplyStateCode: "27",
        hsnCode: "3208",
        productId: "prod-1",
        quantity: -1,
        ratePercent: 18,
        cessPercent: 0,
        taxableAmount: -1000,
        cgst: -90,
        sgst: -90,
        igst: 0,
        cess: 0,
        totalAmount: -1180,
      } satisfies GstSupplyLine,
    ]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    expect(result.creditDebitNotesRegistered).toHaveLength(0);
    expect(result.creditDebitNotesUnregistered).toHaveLength(0);
    // Its negative effect must land somewhere in B2B/B2C/Nil-rated instead —
    // see the netting tests below.
    expect(result.b2b).toHaveLength(1);
  });
});

describe("gstr1Service.getGstr1Return — Sales Return netting (regression: previously excluded entirely)", () => {
  function registeredInvoiceLine(overrides: Partial<GstSupplyLine>) {
    return salesInvoiceLine({
      documentType: "SALES_INVOICE",
      documentId: "inv-net-1",
      partyGstin: "27AAAAA0000A1Z5",
      igst: 0,
      cgst: 90,
      sgst: 90,
      taxableAmount: 1000,
      totalAmount: 1180,
      ...overrides,
    });
  }

  function registeredReturnLine(overrides: Partial<GstSupplyLine>) {
    return salesInvoiceLine({
      documentType: "SALES_RETURN",
      documentId: "sr-net-1",
      partyGstin: "27AAAAA0000A1Z5",
      igst: 0,
      cgst: -90,
      sgst: -90,
      taxableAmount: -1000,
      totalAmount: -1180,
      ...overrides,
    });
  }

  it("nets a registered Sales Return's negative amount into Table 4 (B2B)'s totals", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([registeredInvoiceLine({}), registeredReturnLine({})]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    expect(result.b2b).toHaveLength(2);
    const netTaxable = result.b2b.reduce((sum, group) => sum + group.taxableAmount, 0);
    const netTotal = result.b2b.reduce((sum, group) => sum + group.totalAmount, 0);
    expect(netTaxable).toBe(0);
    expect(netTotal).toBe(0);
  });

  it("nets an unregistered Sales Return's negative amount into the same B2C Small consolidated bucket", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      salesInvoiceLine({
        documentId: "inv-net-2",
        partyGstin: null,
        placeOfSupplyStateCode: "27",
        ratePercent: 18,
        igst: 0,
        cgst: 90,
        sgst: 90,
        taxableAmount: 1000,
        totalAmount: 1180,
      }),
      salesInvoiceLine({
        documentType: "SALES_RETURN",
        documentId: "sr-net-2",
        partyGstin: null,
        placeOfSupplyStateCode: "27",
        ratePercent: 18,
        igst: 0,
        cgst: -90,
        sgst: -90,
        taxableAmount: -1000,
        totalAmount: -1180,
      }),
    ]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    expect(result.b2cSmall).toHaveLength(1);
    expect(result.b2cSmall[0].taxableAmount).toBe(0);
    expect(result.b2cSmall[0].totalAmount).toBe(0);
  });

  it("nets a nil-rated Sales Return's negative amount into Table 8's totals", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      salesInvoiceLine({
        documentId: "inv-net-3",
        partyGstin: null,
        ratePercent: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        taxableAmount: 500,
        totalAmount: 500,
      }),
      salesInvoiceLine({
        documentType: "SALES_RETURN",
        documentId: "sr-net-3",
        partyGstin: null,
        ratePercent: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        taxableAmount: -500,
        totalAmount: -500,
      }),
    ]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    expect(result.nilRated).toHaveLength(1);
    expect(result.nilRated[0].taxableAmount).toBe(0);
    expect(result.nilRated[0].totalAmount).toBe(0);
  });
});

describe("gstr1Service.getGstr1Return — B2C Large threshold uses the invoice's FULL value including nil-rated lines", () => {
  it("classifies an unregistered inter-state invoice as B2C Large when the taxed + nil-rated lines together exceed the threshold, even though the taxed portion alone does not", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      salesInvoiceLine({
        documentId: "inv-mixed-1",
        partyGstin: null,
        ratePercent: 18,
        igst: 27000,
        cgst: 0,
        sgst: 0,
        taxableAmount: 150000,
        totalAmount: 177000,
      }),
      salesInvoiceLine({
        documentId: "inv-mixed-1",
        partyGstin: null,
        ratePercent: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        taxableAmount: 80000,
        totalAmount: 80000,
      }),
    ]);

    const result = await gstr1Service.getGstr1Return({ from: FROM, to: TO });

    // 177000 (taxed) + 80000 (nil) = 257000 > 250000 -> B2C Large, even
    // though the taxed-only portion (177000) alone would not cross it.
    expect(result.b2cLarge).toHaveLength(1);
    expect(result.b2cSmall).toHaveLength(0);
    expect(result.nilRated).toHaveLength(1);
    expect(result.nilRated[0].taxableAmount).toBe(80000);
  });
});

describe("gstr1Service.markPeriodFiled / reopenPeriod", () => {
  const PERIOD_START = new Date("2026-04-01T00:00:00.000Z");
  const PERIOD_END = new Date("2026-04-30T00:00:00.000Z");

  it("creates a FILED record with the given ARN and the acting user/timestamp", async () => {
    findOneMock.mockResolvedValue(null);
    upsertMock.mockResolvedValue({
      id: "rec-1",
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      returnType: "GSTR1",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: "FILED",
      arn: "AA270426000001A",
      filedAt: new Date(),
      filedByUserId: "u1",
    });

    await gstr1Service.markPeriodFiled({ periodStart: PERIOD_START, periodEnd: PERIOD_END, arn: "AA270426000001A" });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "gst", "approve");
    expect(upsertMock).toHaveBeenCalledWith(
      COMPANY_ID,
      FY_ID,
      "GSTR1",
      PERIOD_START,
      PERIOD_END,
      expect.objectContaining({ status: "FILED", arn: "AA270426000001A", filedByUserId: "u1" })
    );
  });

  it("rejects marking the same period filed twice without reopening first", async () => {
    findOneMock.mockResolvedValue({
      id: "rec-1",
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      returnType: "GSTR1",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: "FILED",
      arn: "AA270426000001A",
      filedAt: new Date(),
      filedByUserId: "u1",
    });

    await expect(gstr1Service.markPeriodFiled({ periodStart: PERIOD_START, periodEnd: PERIOD_END })).rejects.toThrow(
      "already been filed"
    );
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("reopenPeriod clears status/filedAt/arn/filedByUserId back to OPEN", async () => {
    findByIdMock.mockResolvedValue({
      id: "rec-1",
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      returnType: "GSTR1",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: "FILED",
      arn: "AA270426000001A",
      filedAt: new Date(),
      filedByUserId: "u1",
    });
    upsertMock.mockResolvedValue({
      id: "rec-1",
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      returnType: "GSTR1",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: "OPEN",
      arn: null,
      filedAt: null,
      filedByUserId: null,
    });

    await gstr1Service.reopenPeriod("rec-1");

    expect(upsertMock).toHaveBeenCalledWith(
      COMPANY_ID,
      FY_ID,
      "GSTR1",
      PERIOD_START,
      PERIOD_END,
      { status: "OPEN", arn: null, filedAt: null, filedByUserId: null }
    );
  });

  it("reopenPeriod rejects a record belonging to another company (cross-tenant isolation)", async () => {
    findByIdMock.mockResolvedValue({
      id: "rec-1",
      companyId: "other-company",
      financialYearId: FY_ID,
      returnType: "GSTR1",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: "FILED",
      arn: null,
      filedAt: new Date(),
      filedByUserId: "u1",
    });

    await expect(gstr1Service.reopenPeriod("rec-1")).rejects.toThrow("not found");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("re-filing after a reopen succeeds (the reopen -> re-file round trip)", async () => {
    findOneMock.mockResolvedValue({
      id: "rec-1",
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      returnType: "GSTR1",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: "OPEN",
      arn: null,
      filedAt: null,
      filedByUserId: null,
    });
    upsertMock.mockResolvedValue({
      id: "rec-1",
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      returnType: "GSTR1",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: "FILED",
      arn: "BB270426000002B",
      filedAt: new Date(),
      filedByUserId: "u1",
    });

    const result = await gstr1Service.markPeriodFiled({
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      arn: "BB270426000002B",
    });

    expect(result.status).toBe("FILED");
    expect(upsertMock).toHaveBeenCalled();
  });
});

// Advisory-only behavior (58-gstr-1.md Business Rules) is a structural
// property, not a runtime branch: markPeriodFiled/reopenPeriod above never
// reference SalesInvoice, PurchaseInvoice, or any other business-document
// table or repository — grep-able, and this file's own mocks would fail
// loudly (an unmocked call) were such a reference ever added. No separate
// "posting still succeeds" test is meaningful here since sales-invoice-service.ts
// itself is untouched and has no knowledge of GstFilingRecord.
