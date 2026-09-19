import { describe, expect, it } from "vitest";
import type { GstFilingRecord } from "@prisma/client";

import { buildGstDashboardReport, resolveMonthlyFilingStatus, toGstDashboardExportTable } from "@/engines/reporting/gst-dashboard";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import type { GstDashboardReport } from "@/types/gst-dashboard";
import type { HsnSummaryRow } from "@/types/hsn-summary";

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

function filingRecord(overrides: Partial<GstFilingRecord> = {}): GstFilingRecord {
  return {
    id: "filing-1",
    companyId: "company-1",
    financialYearId: "fy-1",
    returnType: "GSTR1",
    periodStart: new Date("2026-04-01T00:00:00.000Z"),
    periodEnd: new Date("2026-04-30T00:00:00.000Z"),
    status: "FILED",
    arn: null,
    filedAt: null,
    filedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("buildGstDashboardReport", () => {
  it("buckets outward and inward lines into the same month, correctly summing signed Output/Input/Net figures across 3 months, mixing every document type", () => {
    const outwardLines: GstSupplyLine[] = [
      // April: Sales Invoice + Sales Return + Credit Note + Debit Note
      line({
        documentType: "SALES_INVOICE",
        documentDate: new Date("2026-04-05T00:00:00.000Z"),
        cgst: 90,
        sgst: 90,
        igst: 0,
        cess: 0,
      }),
      line({
        documentType: "SALES_RETURN",
        documentDate: new Date("2026-04-10T00:00:00.000Z"),
        cgst: -18,
        sgst: -18,
        igst: 0,
        cess: 0,
      }),
      line({
        documentType: "CREDIT_NOTE",
        documentDate: new Date("2026-04-15T00:00:00.000Z"),
        productId: null,
        quantity: null,
        cgst: -9,
        sgst: -9,
        igst: 0,
        cess: 0,
      }),
      line({
        documentType: "DEBIT_NOTE",
        documentDate: new Date("2026-04-20T00:00:00.000Z"),
        productId: null,
        quantity: null,
        cgst: 5,
        sgst: 5,
        igst: 0,
        cess: 0,
      }),
      // May: a single Sales Invoice, IGST only
      line({
        documentType: "SALES_INVOICE",
        documentDate: new Date("2026-05-03T00:00:00.000Z"),
        cgst: 0,
        sgst: 0,
        igst: 200,
        cess: 10,
      }),
    ];

    const inwardLines: GstSupplyLine[] = [
      // April: Purchase Invoice + Purchase Return
      line({
        documentType: "PURCHASE_INVOICE",
        documentDate: new Date("2026-04-08T00:00:00.000Z"),
        cgst: 40,
        sgst: 40,
        igst: 0,
        cess: 0,
      }),
      line({
        documentType: "PURCHASE_RETURN",
        documentDate: new Date("2026-04-12T00:00:00.000Z"),
        cgst: -10,
        sgst: -10,
        igst: 0,
        cess: 0,
      }),
      // June: a heavy-purchasing month with no outward activity at all
      line({
        documentType: "PURCHASE_INVOICE",
        documentDate: new Date("2026-06-01T00:00:00.000Z"),
        cgst: 500,
        sgst: 500,
        igst: 0,
        cess: 0,
      }),
    ];

    const result = buildGstDashboardReport(outwardLines, inwardLines);

    expect(result.months.map((m) => m.month)).toEqual(["2026-04", "2026-05", "2026-06"]);

    const april = result.months.find((m) => m.month === "2026-04")!;
    // Output: 90+90 -18-18 -9-9 +5+5 = 136; Input: 40+40 -10-10 = 60
    expect(april.outputTax).toBe(136);
    expect(april.inputTax).toBe(60);
    expect(april.netLiability).toBe(76);

    const may = result.months.find((m) => m.month === "2026-05")!;
    expect(may.outputTax).toBe(210);
    expect(may.inputTax).toBe(0);
    expect(may.netLiability).toBe(210);
  });

  it("shows a negative Net Liability, not clamped to zero, when a month's Input Tax exceeds its Output Tax", () => {
    const result = buildGstDashboardReport(
      [line({ documentDate: new Date("2026-06-05T00:00:00.000Z"), cgst: 50, sgst: 50, igst: 0, cess: 0 })],
      [line({ documentType: "PURCHASE_INVOICE", documentDate: new Date("2026-06-10T00:00:00.000Z"), cgst: 500, sgst: 500, igst: 0, cess: 0 })]
    );

    const june = result.months.find((m) => m.month === "2026-06")!;
    expect(june.outputTax).toBe(100);
    expect(june.inputTax).toBe(1000);
    expect(june.netLiability).toBe(-900);
  });

  it("omits a month with no outward or inward lines rather than zero-filling it", () => {
    const result = buildGstDashboardReport(
      [line({ documentDate: new Date("2026-04-05T00:00:00.000Z") })],
      [line({ documentType: "PURCHASE_INVOICE", documentDate: new Date("2026-06-05T00:00:00.000Z") })]
    );

    expect(result.months.map((m) => m.month)).toEqual(["2026-04", "2026-06"]);
  });
});

describe("resolveMonthlyFilingStatus", () => {
  it("resolves a monthly filer's exact-period record to that single month", () => {
    const overlay = resolveMonthlyFilingStatus(
      ["2026-04"],
      [filingRecord({ periodStart: new Date("2026-04-01T00:00:00.000Z"), periodEnd: new Date("2026-04-30T00:00:00.000Z"), status: "FILED" })]
    );

    expect(overlay.get("2026-04")).toEqual({
      status: "FILED",
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-04-30T00:00:00.000Z"),
    });
  });

  it("overlays the identical quarterly record's status onto all 3 calendar months it spans, not 3 independent flags", () => {
    const quarterlyRecord = filingRecord({
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-06-30T00:00:00.000Z"),
      status: "OPEN",
    });

    const overlay = resolveMonthlyFilingStatus(["2026-04", "2026-05", "2026-06"], [quarterlyRecord]);

    for (const month of ["2026-04", "2026-05", "2026-06"]) {
      expect(overlay.get(month)).toEqual({
        status: "OPEN",
        periodStart: quarterlyRecord.periodStart,
        periodEnd: quarterlyRecord.periodEnd,
      });
    }
  });

  it("resolves to a null status (not tracked) for a month with no matching filing record", () => {
    const overlay = resolveMonthlyFilingStatus(["2026-07"], []);

    expect(overlay.get("2026-07")).toEqual({ status: null, periodStart: null, periodEnd: null });
  });
});

function hsnRow(overrides: Partial<HsnSummaryRow> = {}): HsnSummaryRow {
  return {
    hsnCode: "3208",
    codeType: "HSN",
    description: "Paints",
    ratePercent: 18,
    uqcCode: "NOS",
    isMixedUnit: false,
    quantity: 10,
    taxableAmount: 1000,
    cgst: 90,
    sgst: 90,
    igst: 0,
    cess: 0,
    totalAmount: 1180,
    ...overrides,
  };
}

function gstDashboardReport(overrides: Partial<GstDashboardReport> = {}): GstDashboardReport {
  return {
    months: [{ month: "2026-04", outputTax: 180, inputTax: 90, netLiability: 90, status: "FILED", periodStart: new Date("2026-04-01"), periodEnd: new Date("2026-04-30") }],
    totals: { outputTax: 180, inputTax: 90, netLiability: 90 },
    hsnSummary: { rows: [hsnRow()], totals: { taxableAmount: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0, totalAmount: 1180 } },
    ...overrides,
  };
}

describe("toGstDashboardExportTable", () => {
  it("produces a GST Trend sheet with the filing status label mirroring the on-screen Badge text", () => {
    const tables = toGstDashboardExportTable(gstDashboardReport());

    expect(tables).toHaveLength(2);
    expect(tables[0].sheetName).toBe("GST Trend");
    expect(tables[0].rows).toEqual([
      { month: "2026-04", outputTax: 180, inputTax: 90, netLiability: 90, filingStatus: "Filed" },
    ]);
  });

  it("labels an OPEN/untracked month correctly", () => {
    const report = gstDashboardReport({
      months: [
        { month: "2026-05", outputTax: 0, inputTax: 0, netLiability: 0, status: "OPEN", periodStart: new Date(), periodEnd: new Date() },
        { month: "2026-06", outputTax: 0, inputTax: 0, netLiability: 0, status: null, periodStart: null, periodEnd: null },
      ],
    });

    const tables = toGstDashboardExportTable(report);

    expect(tables[0].rows[0]).toMatchObject({ filingStatus: "Open" });
    expect(tables[0].rows[1]).toMatchObject({ filingStatus: "Not tracked" });
  });

  it("carries the GST Trend totals footer straight from report.totals — never re-summed", () => {
    const report = gstDashboardReport();

    const tables = toGstDashboardExportTable(report);

    expect(tables[0].totals).toEqual({
      month: "Period Total",
      outputTax: report.totals.outputTax,
      inputTax: report.totals.inputTax,
      netLiability: report.totals.netLiability,
      filingStatus: "",
    });
  });

  it("produces an HSN Summary sheet mirroring hsn-summary-table.tsx's own column set, with a 'No HSN Assigned' fallback", () => {
    const report = gstDashboardReport({
      hsnSummary: {
        rows: [hsnRow({ hsnCode: null, codeType: null, description: null, uqcCode: null })],
        totals: { taxableAmount: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0, totalAmount: 1180 },
      },
    });

    const tables = toGstDashboardExportTable(report);

    expect(tables[1].sheetName).toBe("HSN Summary");
    expect(tables[1].rows[0]).toMatchObject({ hsnCode: "No HSN Assigned", codeType: "", description: "", uqcCode: "" });
  });

  it("carries the HSN Summary totals footer straight from report.hsnSummary.totals — never re-summed", () => {
    const report = gstDashboardReport();

    const tables = toGstDashboardExportTable(report);

    expect(tables[1].totals).toEqual({
      hsnCode: "Period Total",
      codeType: "",
      description: "",
      ratePercent: null,
      uqcCode: "",
      quantity: null,
      taxableAmount: report.hsnSummary.totals.taxableAmount,
      cgst: report.hsnSummary.totals.cgst,
      sgst: report.hsnSummary.totals.sgst,
      igst: report.hsnSummary.totals.igst,
      cess: report.hsnSummary.totals.cess,
      totalAmount: report.hsnSummary.totals.totalAmount,
    });
  });
});
