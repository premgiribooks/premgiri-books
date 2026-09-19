import { readFileSync } from "node:fs";
import { join } from "node:path";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { ReportExportInput, ReportExportTable } from "@/types/report-export";

import { exportToExcelBuffer } from "./excel-export";

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's own bundled index.d.ts resolves the ambient `Buffer` type
  // against an older @types/node it declares as a devDependency; pnpm hoists
  // that alongside this project's own (newer, generic) @types/node, so the
  // two "Buffer" types are structurally incompatible even though both are
  // real Node Buffers at runtime.
  // @ts-expect-error — @types/node version skew between this project and exceljs's own bundled types, not a real type error.
  await workbook.xlsx.load(buffer);
  return workbook;
}

function flatTable(overrides: Partial<ReportExportTable> = {}): ReportExportTable {
  return {
    sheetName: "Trial Balance",
    columns: [
      { key: "ledger", header: "Ledger", type: "string" },
      { key: "debit", header: "Debit", type: "currency" },
      { key: "credit", header: "Credit", type: "currency" },
    ],
    rows: [
      { ledger: "Cash in Hand", debit: 15000.5, credit: null },
      { ledger: "Sales Account", debit: null, credit: 15000.5 },
    ],
    ...overrides,
  };
}

describe("exportToExcelBuffer", () => {
  it("produces a valid, readable .xlsx buffer for a single-table input", async () => {
    const buffer = await exportToExcelBuffer([flatTable()]);
    const workbook = await loadWorkbook(buffer);

    expect(workbook.worksheets).toHaveLength(1);
    expect(workbook.worksheets[0].name).toBe("Trial Balance");
    expect(workbook.worksheets[0].getRow(1).getCell(1).value).toBe("Ledger");
    expect(workbook.worksheets[0].getRow(2).getCell(1).value).toBe("Cash in Hand");
  });

  it("produces a multi-table (GSTR-1-shaped) workbook with one worksheet per table, in order", async () => {
    const tables: ReportExportInput = [
      flatTable({ sheetName: "B2B" }),
      flatTable({ sheetName: "B2C Large" }),
      flatTable({ sheetName: "HSN Summary" }),
    ];

    const buffer = await exportToExcelBuffer(tables);
    const workbook = await loadWorkbook(buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["B2B", "B2C Large", "HSN Summary"]);
  });

  it("renders currency columns with 2-decimal Excel number formatting from a plain rupee number", async () => {
    const buffer = await exportToExcelBuffer([flatTable()]);
    const workbook = await loadWorkbook(buffer);

    const debitCell = workbook.worksheets[0].getRow(2).getCell(2);
    expect(debitCell.value).toBe(15000.5);
    expect(debitCell.numFmt).toBe("#,##0.00");
  });

  it("bolds and freezes the header row, directly below an optional title row", async () => {
    const buffer = await exportToExcelBuffer([flatTable({ title: "Trial Balance as of 31-Mar-2027" })]);
    const workbook = await loadWorkbook(buffer);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.getRow(1).getCell(1).value).toBe("Trial Balance as of 31-Mar-2027");
    expect(worksheet.getRow(1).font?.bold).toBe(true);
    expect(worksheet.getRow(2).getCell(1).value).toBe("Ledger");
    expect(worksheet.getRow(2).font?.bold).toBe(true);
    expect(worksheet.getRow(3).getCell(1).value).toBe("Cash in Hand");
    expect(worksheet.views).toMatchObject([{ state: "frozen", ySplit: 2 }]);
  });

  it("sanitizes a sheet name exceeding 31 characters or containing a forbidden character, rather than throwing", async () => {
    const buffer = await exportToExcelBuffer([
      flatTable({ sheetName: "Party-Wise Sales Summary: FY 2026-27 [Provisional]" }),
    ]);
    const workbook = await loadWorkbook(buffer);

    expect(workbook.worksheets[0].name.length).toBeLessThanOrEqual(31);
    expect(workbook.worksheets[0].name).not.toMatch(/[:\\/?*[\]]/);
  });

  it.each([
    ["=HYPERLINK(\"http://attacker.example\",\"Invoice\")", "="],
    ["+cmd|'/c calc'!A1", "+"],
    ["-1+1", "-"],
    ["@SUM(1,1)", "@"],
  ])(
    "prefixes a string cell value that could be read back as a formula (%s) with a leading apostrophe",
    async (maliciousValue) => {
      const buffer = await exportToExcelBuffer([
        flatTable({
          columns: [{ key: "ledger", header: "Ledger", type: "string" }],
          rows: [{ ledger: maliciousValue }],
        }),
      ]);
      const workbook = await loadWorkbook(buffer);

      const cell = workbook.worksheets[0].getRow(2).getCell(1);
      expect(cell.value).toBe(`'${maliciousValue}`);
      expect(typeof cell.value).toBe("string");
    }
  );

  it("prefixes a malicious title row and totals footer value the same way as a data row", async () => {
    const buffer = await exportToExcelBuffer([
      flatTable({
        title: '=cmd|"/c calc"!A1',
        totals: { ledger: "=SUM(A1:A2)", debit: 0, credit: 0 },
      }),
    ]);
    const workbook = await loadWorkbook(buffer);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.getRow(1).getCell(1).value).toBe('\'=cmd|"/c calc"!A1');
    const lastRow = worksheet.getRow(worksheet.rowCount);
    expect(lastRow.getCell(1).value).toBe("'=SUM(A1:A2)");
  });

  it("leaves an ordinary string value (no leading formula-trigger character) untouched", async () => {
    const buffer = await exportToExcelBuffer([flatTable()]);
    const workbook = await loadWorkbook(buffer);

    expect(workbook.worksheets[0].getRow(2).getCell(1).value).toBe("Cash in Hand");
  });

  it("falls back to a default sheet name when sanitization strips every character", async () => {
    const buffer = await exportToExcelBuffer([flatTable({ sheetName: "???:::" })]);
    const workbook = await loadWorkbook(buffer);

    expect(workbook.worksheets[0].name).toBe("Sheet");
  });

  it("renders the optional totals footer row as the sheet's last row, keyed like the data rows", async () => {
    const buffer = await exportToExcelBuffer([
      flatTable({ totals: { ledger: "Grand Total", debit: 15000.5, credit: 15000.5 } }),
    ]);
    const workbook = await loadWorkbook(buffer);
    const worksheet = workbook.worksheets[0];

    const lastRow = worksheet.getRow(worksheet.rowCount);
    expect(lastRow.getCell(1).value).toBe("Grand Total");
    expect(lastRow.getCell(2).value).toBe(15000.5);
    expect(lastRow.font?.bold).toBe(true);
  });

  it("computes a sane auto column width from header/sample-cell length when no explicit width is given", async () => {
    const buffer = await exportToExcelBuffer([
      flatTable({
        columns: [{ key: "ledger", header: "Ledger", type: "string" }],
        rows: [{ ledger: "A very long ledger name that should widen the column" }],
      }),
    ]);
    const workbook = await loadWorkbook(buffer);

    const width = workbook.worksheets[0].getColumn(1).width;
    expect(width).toBeGreaterThan("Ledger".length);
    expect(width).toBeLessThanOrEqual(60);
  });

  it("respects an explicit column width when one is given, ignoring the auto-computed value", async () => {
    const buffer = await exportToExcelBuffer([
      flatTable({
        columns: [{ key: "ledger", header: "Ledger", type: "string", width: 12 }],
        rows: [{ ledger: "A very long ledger name that would otherwise widen the column a lot" }],
      }),
    ]);
    const workbook = await loadWorkbook(buffer);

    expect(workbook.worksheets[0].getColumn(1).width).toBe(12);
  });

  it("uses the streaming writer path for a large (>5,000-row) single table without exceeding a bounded time budget", async () => {
    const rows = Array.from({ length: 6000 }, (_, index) => ({
      ledger: `Ledger ${index}`,
      debit: index,
      credit: null,
    }));

    const startedAt = Date.now();
    const buffer = await exportToExcelBuffer([flatTable({ rows })]);
    expect(Date.now() - startedAt).toBeLessThan(15_000);

    const workbook = await loadWorkbook(buffer);
    const worksheet = workbook.worksheets[0];
    // header row + 6000 data rows
    expect(worksheet.rowCount).toBe(6001);
    expect(worksheet.getRow(6001).getCell(1).value).toBe("Ledger 5999");
  }, 20_000);

  it("never imports from src/modules/** or @prisma/client — a pure format utility, per the spec's own structural rule", () => {
    const source = readFileSync(join(__dirname, "excel-export.ts"), "utf-8");
    expect(source).not.toMatch(/from ["']@\/modules\//);
    expect(source).not.toMatch(/from ["']@prisma\/client["']/);
  });
});
