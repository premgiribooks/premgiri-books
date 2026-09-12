import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getOutwardSupplyLinesMock,
  getInwardSupplyLinesMock,
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getHsnSummaryMock,
  findManyFilingRecordsMock,
} = vi.hoisted(() => ({
  getOutwardSupplyLinesMock: vi.fn(),
  getInwardSupplyLinesMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getHsnSummaryMock: vi.fn(),
  findManyFilingRecordsMock: vi.fn(),
}));

vi.mock("@/engines/gst/gst-report-queries", () => ({
  getOutwardSupplyLines: getOutwardSupplyLinesMock,
  getInwardSupplyLines: getInwardSupplyLinesMock,
}));
vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/modules/gst/services/hsn-summary-service", () => ({
  hsnSummaryService: { getHsnSummary: getHsnSummaryMock },
}));
vi.mock("@/modules/gst/repositories/gst-filing-repository", () => ({
  gstFilingRepository: { findMany: findManyFilingRecordsMock },
}));

import { gstReportsService } from "@/modules/reports/services/gst-reports-service";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const ZERO_HSN_SUMMARY = { rows: [], totals: { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalAmount: 0 } };

function line(overrides: Partial<GstSupplyLine> & { documentDate: Date }): GstSupplyLine {
  return {
    documentType: "SALES_INVOICE",
    documentId: "doc-1",
    documentNumber: "INV-0001",
    partyId: "party-1",
    partyName: "Acme",
    partyGstin: null,
    placeOfSupplyStateCode: "27",
    hsnCode: "3208",
    productId: "prod-1",
    quantity: 10,
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

beforeEach(() => {
  getOutwardSupplyLinesMock.mockReset().mockResolvedValue([]);
  getInwardSupplyLinesMock.mockReset().mockResolvedValue([]);
  getHsnSummaryMock.mockReset().mockResolvedValue(ZERO_HSN_SUMMARY);
  findManyFilingRecordsMock.mockReset().mockResolvedValue([]);
  getCurrentCompanyUserMock.mockReset().mockResolvedValue({ id: "u1", companyId: COMPANY_ID, role: "Accountant" });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
});

describe("gstReportsService.getGstDashboard", () => {
  it("requires both reports/view and gst/view permissions", async () => {
    await gstReportsService.getGstDashboard({ from: "2026-04-01", to: "2026-04-30" });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.objectContaining({ companyId: COMPANY_ID }), "reports", "view");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.objectContaining({ companyId: COMPANY_ID }), "gst", "view");
  });

  it("rejects when reports/view is missing even if gst/view is present", async () => {
    assertPermissionMock.mockImplementation(async (_user, module: string) => {
      if (module === "reports") {
        throw new Error("You do not have permission to view reports.");
      }
    });

    await expect(gstReportsService.getGstDashboard({ from: "2026-04-01", to: "2026-04-30" })).rejects.toThrow(
      "You do not have permission to view reports."
    );
  });

  it("rejects when gst/view is missing even if reports/view is present", async () => {
    assertPermissionMock.mockImplementation(async (_user, module: string) => {
      if (module === "gst") {
        throw new Error("You do not have permission to view gst.");
      }
    });

    await expect(gstReportsService.getGstDashboard({ from: "2026-04-01", to: "2026-04-30" })).rejects.toThrow(
      "You do not have permission to view gst."
    );
  });

  it("calls getOutwardSupplyLines/getInwardSupplyLines and hsnSummaryService.getHsnSummary with the same company/date range, and never re-derives HSN aggregation itself", async () => {
    await gstReportsService.getGstDashboard({ from: "2026-04-01", to: "2026-04-30" });

    const from = new Date("2026-04-01T00:00:00.000Z");
    const to = new Date("2026-04-30T00:00:00.000Z");
    expect(getOutwardSupplyLinesMock).toHaveBeenCalledWith(COMPANY_ID, from, to);
    expect(getInwardSupplyLinesMock).toHaveBeenCalledWith(COMPANY_ID, from, to);
    expect(getHsnSummaryMock).toHaveBeenCalledWith({ from, to });
    expect(findManyFilingRecordsMock).toHaveBeenCalledWith(COMPANY_ID, "GSTR1", from, to);
  });

  it("embeds hsnSummaryService's own output unmodified", async () => {
    const hsnSummary = { rows: [{ hsnCode: "3208" }], totals: { taxableAmount: 100, cgst: 9, sgst: 9, igst: 0, cess: 0, totalAmount: 118 } };
    getHsnSummaryMock.mockResolvedValue(hsnSummary);

    const result = await gstReportsService.getGstDashboard({ from: "2026-04-01", to: "2026-04-30" });

    expect(result.hsnSummary).toBe(hsnSummary);
  });

  it("sums the month-bucketed totals into the report's own totals, matching a hand-computed figure", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      line({ documentDate: new Date("2026-04-05T00:00:00.000Z"), cgst: 90, sgst: 90 }),
      line({ documentDate: new Date("2026-05-05T00:00:00.000Z"), cgst: 10, sgst: 10 }),
    ]);
    getInwardSupplyLinesMock.mockResolvedValue([
      line({ documentType: "PURCHASE_INVOICE", documentDate: new Date("2026-04-08T00:00:00.000Z"), cgst: 30, sgst: 30 }),
    ]);

    const result = await gstReportsService.getGstDashboard({ from: "2026-04-01", to: "2026-05-31" });

    expect(result.totals).toEqual({ outputTax: 200, inputTax: 60, netLiability: 140 });
  });

  it("overlays a quarterly GstFilingRecord's status onto every bucketed month it spans", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      line({ documentDate: new Date("2026-04-05T00:00:00.000Z") }),
      line({ documentDate: new Date("2026-05-05T00:00:00.000Z") }),
      line({ documentDate: new Date("2026-06-05T00:00:00.000Z") }),
    ]);
    findManyFilingRecordsMock.mockResolvedValue([
      {
        id: "f1",
        companyId: COMPANY_ID,
        financialYearId: "fy-1",
        returnType: "GSTR1",
        periodStart: new Date("2026-04-01T00:00:00.000Z"),
        periodEnd: new Date("2026-06-30T00:00:00.000Z"),
        status: "FILED",
        arn: null,
        filedAt: null,
        filedByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await gstReportsService.getGstDashboard({ from: "2026-04-01", to: "2026-06-30" });

    expect(result.months).toHaveLength(3);
    for (const month of result.months) {
      expect(month.status).toBe("FILED");
    }
  });

  it("marks a month with no matching GstFilingRecord as not tracked (status null)", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([line({ documentDate: new Date("2026-07-05T00:00:00.000Z") })]);

    const result = await gstReportsService.getGstDashboard({ from: "2026-07-01", to: "2026-07-31" });

    expect(result.months[0].status).toBeNull();
  });

  it("scopes every read to the caller's own company (cross-company isolation)", async () => {
    await gstReportsService.getGstDashboard({ from: "2026-04-01", to: "2026-04-30" });

    expect(getOutwardSupplyLinesMock).toHaveBeenCalledWith(COMPANY_ID, expect.any(Date), expect.any(Date));
    expect(getInwardSupplyLinesMock).toHaveBeenCalledWith(COMPANY_ID, expect.any(Date), expect.any(Date));
    expect(findManyFilingRecordsMock).toHaveBeenCalledWith(COMPANY_ID, "GSTR1", expect.any(Date), expect.any(Date));
  });
});
