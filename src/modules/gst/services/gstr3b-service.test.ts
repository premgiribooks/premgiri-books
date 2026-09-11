import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getOutwardSupplyLinesMock,
  getInwardSupplyLinesMock,
  determineSupplyTypeMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  findOneMock,
  findByIdMock,
  upsertMock,
  companyFindUniqueMock,
} = vi.hoisted(() => ({
  getOutwardSupplyLinesMock: vi.fn(),
  getInwardSupplyLinesMock: vi.fn(),
  determineSupplyTypeMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  findOneMock: vi.fn(),
  findByIdMock: vi.fn(),
  upsertMock: vi.fn(),
  companyFindUniqueMock: vi.fn(),
}));

vi.mock("@/engines/gst/gst-engine", () => ({
  gstReportEngine: { getOutwardSupplyLines: getOutwardSupplyLinesMock, getInwardSupplyLines: getInwardSupplyLinesMock },
  determineSupplyType: determineSupplyTypeMock,
}));
vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/prisma", () => ({ prisma: { company: { findUnique: companyFindUniqueMock } } }));
vi.mock("@/modules/gst/repositories/gst-filing-repository", () => ({
  gstFilingRepository: { findOne: findOneMock, findById: findByIdMock, upsert: upsertMock },
}));

import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import { gstr3bService } from "@/modules/gst/services/gstr3b-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const FROM = new Date("2026-04-01T00:00:00.000Z");
const TO = new Date("2026-04-30T00:00:00.000Z");

function outwardLine(overrides: Partial<GstSupplyLine>): GstSupplyLine {
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
    cgst: 90,
    sgst: 90,
    igst: 0,
    cess: 0,
    totalAmount: 1180,
    ...overrides,
  };
}

function inwardLine(overrides: Partial<GstSupplyLine>): GstSupplyLine {
  return {
    documentType: "PURCHASE_INVOICE",
    documentId: "pur-1",
    documentNumber: "PUR-0001",
    documentDate: new Date("2026-04-05T00:00:00.000Z"),
    partyId: "supplier-1",
    partyName: "Supplier Co",
    partyGstin: "27AAAAA0000A1Z5",
    placeOfSupplyStateCode: "27",
    hsnCode: "3208",
    productId: "prod-1",
    quantity: 1,
    ratePercent: 18,
    cessPercent: 0,
    taxableAmount: 500,
    cgst: 45,
    sgst: 45,
    igst: 0,
    cess: 0,
    totalAmount: 590,
    ...overrides,
  };
}

beforeEach(() => {
  getOutwardSupplyLinesMock.mockReset().mockResolvedValue([]);
  getInwardSupplyLinesMock.mockReset().mockResolvedValue([]);
  determineSupplyTypeMock.mockReset();
  getCurrentFinancialYearMock.mockReset().mockResolvedValue({ id: FY_ID });
  getCurrentCompanyUserMock.mockReset().mockResolvedValue({ id: "u1", companyId: COMPANY_ID, role: "Company Admin" });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
  findOneMock.mockReset();
  findByIdMock.mockReset();
  upsertMock.mockReset();
  companyFindUniqueMock.mockReset().mockResolvedValue({ stateCode: "27" });
});

describe("gstr3bService.getGstr3BReturn — Table 3.1(a)/(c) ratePercent = 0 boundary", () => {
  it("routes a taxed line to (a) and a ratePercent=0 line to (c), never both", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      outwardLine({ documentId: "taxed", ratePercent: 18, taxableAmount: 1000, cgst: 90, sgst: 90 }),
      outwardLine({ documentId: "nil", ratePercent: 0, taxableAmount: 400, cgst: 0, sgst: 0, igst: 0, cess: 0 }),
    ]);

    const result = await gstr3bService.getGstr3BReturn({ from: FROM, to: TO });

    expect(result.outwardSupplies.taxableOutwardSupplies.computed).toBe(true);
    expect(result.outwardSupplies.taxableOutwardSupplies.taxableAmount).toBe(1000);
    expect(result.outwardSupplies.taxableOutwardSupplies.cgst).toBe(90);
    expect(result.outwardSupplies.nilRatedExemptOutwardSupplies.computed).toBe(true);
    expect(result.outwardSupplies.nilRatedExemptOutwardSupplies.taxableAmount).toBe(400);
  });

  it("nets a Sales Return's negative amount and a Debit Note's positive amount into (a), signed per the netting rule", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      outwardLine({ documentType: "SALES_INVOICE", documentId: "inv-1", taxableAmount: 1000, cgst: 90, sgst: 90 }),
      outwardLine({
        documentType: "SALES_RETURN",
        documentId: "sr-1",
        taxableAmount: -300,
        cgst: -27,
        sgst: -27,
        totalAmount: -354,
      }),
      outwardLine({
        documentType: "CREDIT_NOTE",
        documentId: "cn-1",
        taxableAmount: -100,
        cgst: -9,
        sgst: -9,
        totalAmount: -118,
      }),
      outwardLine({
        documentType: "DEBIT_NOTE",
        documentId: "dn-1",
        taxableAmount: 200,
        cgst: 18,
        sgst: 18,
        totalAmount: 236,
      }),
    ]);

    const result = await gstr3bService.getGstr3BReturn({ from: FROM, to: TO });

    // 1000 - 300 - 100 + 200 = 800
    expect(result.outwardSupplies.taxableOutwardSupplies.taxableAmount).toBe(800);
    expect(result.outwardSupplies.taxableOutwardSupplies.cgst).toBe(72);
  });
});

describe("gstr3bService.getGstr3BReturn — not-computed rows are always present", () => {
  it("shows every Table 3.1/4/5/5.1 not-computed row with computed:false and a non-empty reason", async () => {
    const result = await gstr3bService.getGstr3BReturn({ from: FROM, to: TO });

    expect(result.outwardSupplies.zeroRatedOutwardSupplies.computed).toBe(false);
    expect(result.outwardSupplies.zeroRatedOutwardSupplies.reason.length).toBeGreaterThan(0);
    expect(result.outwardSupplies.inwardReverseChargeSupplies.computed).toBe(false);
    expect(result.outwardSupplies.inwardReverseChargeSupplies.reason.length).toBeGreaterThan(0);
    expect(result.outwardSupplies.nonGstOutwardSupplies.computed).toBe(false);
    expect(result.outwardSupplies.nonGstOutwardSupplies.reason.length).toBeGreaterThan(0);

    expect(result.interStateSupplies.compositionTaxpayers.computed).toBe(false);
    expect(result.interStateSupplies.compositionTaxpayers.reason.length).toBeGreaterThan(0);
    expect(result.interStateSupplies.uinHolders.computed).toBe(false);
    expect(result.interStateSupplies.uinHolders.reason.length).toBeGreaterThan(0);

    expect(result.eligibleItc.importOfGoods.computed).toBe(false);
    expect(result.eligibleItc.importOfGoods.reason.length).toBeGreaterThan(0);
    expect(result.eligibleItc.importOfServices.computed).toBe(false);
    expect(result.eligibleItc.importOfServices.reason.length).toBeGreaterThan(0);
    expect(result.eligibleItc.inwardReverseChargeItc.computed).toBe(false);
    expect(result.eligibleItc.inwardReverseChargeItc.reason.length).toBeGreaterThan(0);
    expect(result.eligibleItc.isdCredit.computed).toBe(false);
    expect(result.eligibleItc.isdCredit.reason.length).toBeGreaterThan(0);
    expect(result.eligibleItc.itcReversed.computed).toBe(false);
    expect(result.eligibleItc.itcReversed.reason.length).toBeGreaterThan(0);
    expect(result.eligibleItc.ineligibleItc.computed).toBe(false);
    expect(result.eligibleItc.ineligibleItc.reason.length).toBeGreaterThan(0);

    expect(result.exemptInwardSupplies.nonGst.computed).toBe(false);
    expect(result.exemptInwardSupplies.nonGst.reason.length).toBeGreaterThan(0);

    expect(result.interestLateFee.computed).toBe(false);
    expect(result.interestLateFee.reason.length).toBeGreaterThan(0);
  });

  it("never omits a not-computed key from the returned shape, even when its computed figure would be zero", async () => {
    const result = await gstr3bService.getGstr3BReturn({ from: FROM, to: TO });

    expect(result.outwardSupplies).toHaveProperty("zeroRatedOutwardSupplies");
    expect(result.eligibleItc).toHaveProperty("importOfGoods");
    expect(result.exemptInwardSupplies).toHaveProperty("nonGst");
  });
});

describe("gstr3bService.getGstr3BReturn — Table 3.2 unregistered inter-state consolidation", () => {
  it("consolidates Sales Invoice/Sales Return unregistered inter-state lines by state, excluding intra-state and registered lines", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      outwardLine({
        documentId: "a",
        partyGstin: null,
        placeOfSupplyStateCode: "29",
        igst: 180,
        cgst: 0,
        sgst: 0,
        taxableAmount: 1000,
      }),
      outwardLine({
        documentId: "b",
        partyGstin: null,
        placeOfSupplyStateCode: "29",
        igst: 90,
        cgst: 0,
        sgst: 0,
        taxableAmount: 500,
      }),
      // Intra-state (same-state) unregistered line — must be excluded.
      outwardLine({ documentId: "c", partyGstin: null, placeOfSupplyStateCode: "27", igst: 0, cgst: 90, sgst: 90, taxableAmount: 1000 }),
      // Registered (has GSTIN) inter-state line — must be excluded (belongs to Table 4/B2B, not 3.2).
      outwardLine({
        documentId: "d",
        partyGstin: "29BBBBB0000B1Z5",
        placeOfSupplyStateCode: "29",
        igst: 180,
        cgst: 0,
        sgst: 0,
        taxableAmount: 1000,
      }),
      // Credit Note — out of scope for 3.2 (mirrors gstr1's Table 5/7 scope).
      outwardLine({
        documentType: "CREDIT_NOTE",
        documentId: "e",
        partyGstin: null,
        placeOfSupplyStateCode: "29",
        igst: -90,
        cgst: 0,
        sgst: 0,
        taxableAmount: -500,
      }),
    ]);

    const result = await gstr3bService.getGstr3BReturn({ from: FROM, to: TO });

    expect(result.interStateSupplies.unregisteredRecipients).toHaveLength(1);
    const group = result.interStateSupplies.unregisteredRecipients[0];
    expect(group.placeOfSupplyStateCode).toBe("29");
    expect(group.taxableAmount).toBe(1500);
    expect(group.igst).toBe(270);
  });

  it("nets an unregistered inter-state Sales Return's negative igst into the same state bucket (igst !== 0, not > 0)", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      outwardLine({ documentId: "inv", partyGstin: null, placeOfSupplyStateCode: "29", igst: 180, cgst: 0, sgst: 0, taxableAmount: 1000 }),
      outwardLine({
        documentType: "SALES_RETURN",
        documentId: "sr",
        partyGstin: null,
        placeOfSupplyStateCode: "29",
        igst: -180,
        cgst: 0,
        sgst: 0,
        taxableAmount: -1000,
      }),
    ]);

    const result = await gstr3bService.getGstr3BReturn({ from: FROM, to: TO });

    expect(result.interStateSupplies.unregisteredRecipients).toHaveLength(1);
    expect(result.interStateSupplies.unregisteredRecipients[0].taxableAmount).toBe(0);
    expect(result.interStateSupplies.unregisteredRecipients[0].igst).toBe(0);
  });
});

describe("gstr3bService.getGstr3BReturn — Table 4(A)(5)/(C) net ITC", () => {
  it("(A)(5) equals the sum of posted Purchase Invoice input-tax columns net of Purchase Return's own columns", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([
      inwardLine({ documentType: "PURCHASE_INVOICE", documentId: "pur-1", cgst: 90, sgst: 90, igst: 0, cess: 0 }),
      inwardLine({ documentType: "PURCHASE_RETURN", documentId: "ret-1", cgst: -30, sgst: -30, igst: 0, cess: 0 }),
    ]);

    const result = await gstr3bService.getGstr3BReturn({ from: FROM, to: TO });

    expect(result.eligibleItc.allOtherItc.computed).toBe(true);
    expect(result.eligibleItc.allOtherItc.cgst).toBe(60);
    expect(result.eligibleItc.allOtherItc.sgst).toBe(60);
  });

  it("(C) net ITC available equals (A)(5) exactly, since (B) ITC reversed is always 0", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([inwardLine({ cgst: 45, sgst: 45, igst: 0, cess: 5 })]);

    const result = await gstr3bService.getGstr3BReturn({ from: FROM, to: TO });

    expect(result.eligibleItc.netItcAvailable.cgst).toBe(result.eligibleItc.allOtherItc.cgst);
    expect(result.eligibleItc.netItcAvailable.sgst).toBe(result.eligibleItc.allOtherItc.sgst);
    expect(result.eligibleItc.netItcAvailable.igst).toBe(result.eligibleItc.allOtherItc.igst);
    expect(result.eligibleItc.netItcAvailable.cess).toBe(result.eligibleItc.allOtherItc.cess);
    expect(result.eligibleItc.netItcAvailable.computed).toBe(true);
    expect(result.eligibleItc.netItcAvailable.reason.length).toBeGreaterThan(0);
  });
});

describe("gstr3bService.getGstr3BReturn — Table 5 nil-rated inward intra/inter split", () => {
  it("splits nil-rated inward lines by intra-state vs. inter-state using the company's own state code", async () => {
    companyFindUniqueMock.mockResolvedValue({ stateCode: "27" });
    determineSupplyTypeMock.mockImplementation((companyStateCode: string, placeOfSupplyStateCode: string) =>
      companyStateCode === placeOfSupplyStateCode ? "INTRA_STATE" : "INTER_STATE"
    );
    getInwardSupplyLinesMock.mockResolvedValue([
      inwardLine({ documentId: "intra", ratePercent: 0, placeOfSupplyStateCode: "27", cgst: 0, sgst: 0, igst: 0, taxableAmount: 300 }),
      inwardLine({ documentId: "inter", ratePercent: 0, placeOfSupplyStateCode: "29", cgst: 0, sgst: 0, igst: 0, taxableAmount: 700 }),
      // Taxed line — excluded from Table 5 entirely.
      inwardLine({ documentId: "taxed", ratePercent: 18, placeOfSupplyStateCode: "27", cgst: 90, sgst: 90, taxableAmount: 1000 }),
    ]);

    const result = await gstr3bService.getGstr3BReturn({ from: FROM, to: TO });

    expect(result.exemptInwardSupplies.intraState.computed).toBe(true);
    expect(result.exemptInwardSupplies.intraState.amount).toBe(300);
    expect(result.exemptInwardSupplies.interState.computed).toBe(true);
    expect(result.exemptInwardSupplies.interState.amount).toBe(700);
  });

  it("falls back to a visible not-computed row for both intra/inter-state when the company's GST state code is unset", async () => {
    companyFindUniqueMock.mockResolvedValue({ stateCode: null });
    getInwardSupplyLinesMock.mockResolvedValue([inwardLine({ ratePercent: 0, cgst: 0, sgst: 0, igst: 0, taxableAmount: 300 })]);

    const result = await gstr3bService.getGstr3BReturn({ from: FROM, to: TO });

    expect(result.exemptInwardSupplies.intraState.computed).toBe(false);
    expect(result.exemptInwardSupplies.intraState.reason.length).toBeGreaterThan(0);
    expect(result.exemptInwardSupplies.interState.computed).toBe(false);
    expect(result.exemptInwardSupplies.interState.reason.length).toBeGreaterThan(0);
    expect(determineSupplyTypeMock).not.toHaveBeenCalled();
  });
});

describe("gstr3bService.markPeriodFiled / reopenPeriod — independent of GSTR-1's own filing record", () => {
  const PERIOD_START = new Date("2026-04-01T00:00:00.000Z");
  const PERIOD_END = new Date("2026-04-30T00:00:00.000Z");

  it("marks a GSTR3B period filed using returnType: GSTR3B, independent of any GSTR1 record for the same period", async () => {
    findOneMock.mockResolvedValue(null);
    upsertMock.mockResolvedValue({
      id: "rec-3b-1",
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      returnType: "GSTR3B",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: "FILED",
      arn: "AA270426000099Z",
      filedAt: new Date(),
      filedByUserId: "u1",
    });

    await gstr3bService.markPeriodFiled({ periodStart: PERIOD_START, periodEnd: PERIOD_END, arn: "AA270426000099Z" });

    expect(findOneMock).toHaveBeenCalledWith(COMPANY_ID, "GSTR3B", PERIOD_START, PERIOD_END);
    expect(upsertMock).toHaveBeenCalledWith(
      COMPANY_ID,
      FY_ID,
      "GSTR3B",
      PERIOD_START,
      PERIOD_END,
      expect.objectContaining({ status: "FILED", arn: "AA270426000099Z", filedByUserId: "u1" })
    );
  });

  it("rejects marking the same GSTR3B period filed twice without reopening first", async () => {
    findOneMock.mockResolvedValue({
      id: "rec-3b-1",
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      returnType: "GSTR3B",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: "FILED",
      arn: null,
      filedAt: new Date(),
      filedByUserId: "u1",
    });

    await expect(gstr3bService.markPeriodFiled({ periodStart: PERIOD_START, periodEnd: PERIOD_END })).rejects.toThrow(
      "already been filed"
    );
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("reopenPeriod rejects a record belonging to another company (cross-tenant isolation)", async () => {
    findByIdMock.mockResolvedValue({
      id: "rec-3b-1",
      companyId: "other-company",
      financialYearId: FY_ID,
      returnType: "GSTR3B",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: "FILED",
      arn: null,
      filedAt: new Date(),
      filedByUserId: "u1",
    });

    await expect(gstr3bService.reopenPeriod("rec-3b-1")).rejects.toThrow("not found");
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
