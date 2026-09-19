import { describe, expect, it } from "vitest";

import type { ReportExportTable } from "@/types/report-export";

import { buildReportHtml } from "./report-pdf-template";

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const SIMPLE_TABLE: ReportExportTable = {
  sheetName: "Trial Balance",
  title: "Trial Balance",
  columns: [
    { key: "particulars", header: "Particulars", type: "string" },
    { key: "debit", header: "Debit", type: "currency" },
    { key: "credit", header: "Credit", type: "currency" },
  ],
  rows: [
    { particulars: "Cash", debit: 1000, credit: null },
    { particulars: "Sales", debit: null, credit: 1000 },
  ],
  totals: { particulars: "Grand Total", debit: 1000, credit: 1000 },
};

// A GSTR-1-shaped multi-section fixture: several small tables in one
// "workbook" input, exactly what a multi-sheet Excel export would also
// receive (78-pdf-generation.md: "GSTR-1's multi-section shape becomes
// multiple sequential same-document sections").
const GSTR1_SECTIONS: ReportExportTable[] = [
  {
    sheetName: "B2B",
    title: "B2B Invoices",
    columns: [
      { key: "gstin", header: "GSTIN", type: "string" },
      { key: "taxable", header: "Taxable Value", type: "currency" },
    ],
    rows: [{ gstin: "29ABCDE1234F1Z5", taxable: 5000 }],
  },
  {
    sheetName: "B2C",
    title: "B2C (Large)",
    columns: [
      { key: "state", header: "State", type: "string" },
      { key: "taxable", header: "Taxable Value", type: "currency" },
    ],
    rows: [{ state: "Karnataka", taxable: 2500 }],
  },
];

describe("buildReportHtml", () => {
  it("renders one HTML table per input ReportExportTable, in order", () => {
    const html = buildReportHtml(GSTR1_SECTIONS);

    expect(countOccurrences(html, "<table")).toBe(2);
    const b2bIndex = html.indexOf("B2B Invoices");
    const b2cIndex = html.indexOf("B2C (Large)");
    expect(b2bIndex).toBeGreaterThan(-1);
    expect(b2cIndex).toBeGreaterThan(b2bIndex);
  });

  it("renders a single table's header, rows, and cell values", () => {
    const html = buildReportHtml([SIMPLE_TABLE]);

    expect(html).toContain("<th");
    expect(html).toContain("Particulars");
    expect(html).toContain("Cash");
    expect(html).toContain("1000.00");
  });

  it("renders a null cell as an empty string, not the literal 'null'", () => {
    const html = buildReportHtml([SIMPLE_TABLE]);

    expect(html).not.toContain("null");
  });

  it("renders an optional totals footer row when present", () => {
    const html = buildReportHtml([SIMPLE_TABLE]);

    expect(html).toContain("<tfoot>");
    expect(html).toContain("Grand Total");
  });

  it("omits the totals footer row when absent", () => {
    const tableWithoutTotals: ReportExportTable = { ...SIMPLE_TABLE, totals: undefined };

    const html = buildReportHtml([tableWithoutTotals]);

    expect(html).not.toContain("<tfoot>");
  });

  it("escapes a <script>-bearing cell value (XSS guard)", () => {
    const maliciousTable: ReportExportTable = {
      sheetName: "Sheet1",
      columns: [{ key: "name", header: "Name", type: "string" }],
      rows: [{ name: "<script>alert('xss')</script>" }],
    };

    const html = buildReportHtml([maliciousTable]);

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes a <script>-bearing title and header (XSS guard)", () => {
    const maliciousTable: ReportExportTable = {
      sheetName: "Sheet1",
      title: "<script>alert('title')</script>",
      columns: [{ key: "name", header: "<script>alert('header')</script>", type: "string" }],
      rows: [],
    };

    const html = buildReportHtml([maliciousTable]);

    expect(html).not.toContain("<script>alert");
  });

  it("formats a Date cell as a plain readable date string", () => {
    const tableWithDate: ReportExportTable = {
      sheetName: "Sheet1",
      columns: [{ key: "date", header: "Date", type: "date" }],
      rows: [{ date: new Date(2027, 2, 31) }],
    };

    const html = buildReportHtml([tableWithDate]);

    expect(html).toContain("31-Mar-2027");
  });

  it("right-aligns a currency/number cell via the shared stylesheet's text-right class", () => {
    const html = buildReportHtml([SIMPLE_TABLE]);

    expect(html).toContain('class="text-right"');
  });

  it("embeds the shared print stylesheet", () => {
    const html = buildReportHtml([SIMPLE_TABLE]);

    expect(html).toContain("<style>");
    expect(html).toContain("box-sizing: border-box");
  });

  it("wraps the output in a single HTML document", () => {
    const html = buildReportHtml([SIMPLE_TABLE]);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html>");
    expect(html).toContain("</html>");
  });
});
