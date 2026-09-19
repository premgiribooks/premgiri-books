import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import type { ImportReport, ImportTarget } from "@/types/bulk-import";

import {
  buildImportErrorReport,
  buildImportTemplate,
  commitImport,
  parseImportFile,
  previewImport,
} from "./bulk-import-service";

interface FakeInput {
  name: string;
  note?: string;
}

function makeFakeTarget(): ImportTarget<FakeInput> {
  return {
    key: "products",
    label: "Fake Target",
    columns: [
      { key: "name", header: "Name", required: true, example: "Sample" },
      { key: "note", header: "Note", required: false, example: "" },
    ],
    resolveRow: vi.fn(async (row: Record<string, string>) => {
      if (!row.name) {
        return { status: "invalid" as const, errors: ["Name is required."] };
      }
      if (row.name === "DUPLICATE") {
        return { status: "invalid" as const, errors: ['A row named "DUPLICATE" already exists.'] };
      }
      return { status: "valid" as const, input: { name: row.name, note: row.note } };
    }),
    createRow: vi.fn(async (input: FakeInput) => {
      if (input.name === "FAILS_AT_COMMIT") {
        throw new AppError("Duplicate product code.");
      }
      return { id: `id-${input.name}` };
    }),
  };
}

async function buildXlsxBuffer(headerRow: string[], dataRows: string[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  worksheet.addRow(headerRow);
  for (const row of dataRows) {
    worksheet.addRow(row);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function buildCsvBuffer(headerRow: string[], dataRows: string[][]): Buffer {
  const lines = [headerRow, ...dataRows].map((row) => row.join(","));
  return Buffer.from(lines.join("\n"));
}

describe("parseImportFile", () => {
  it("parses an .xlsx file into rows keyed by the target's own column key, matching headers case-insensitively", async () => {
    const target = makeFakeTarget();
    const buffer = await buildXlsxBuffer(["name", "NOTE"], [["Alpha", "first"], ["Beta", "second"]]);

    const rows = await parseImportFile(target, buffer, "products.xlsx");

    expect(rows).toEqual([
      { rowNumber: 2, row: { name: "Alpha", note: "first" } },
      { rowNumber: 3, row: { name: "Beta", note: "second" } },
    ]);
  });

  it("round-trips its own downloadable template — a required column's header carries buildImportTemplate's own trailing ' *' marker", async () => {
    const target = makeFakeTarget();
    const buffer = await buildXlsxBuffer(["Name *", "Note"], [["Alpha", "first"]]);

    const rows = await parseImportFile(target, buffer, "products.xlsx");

    expect(rows).toEqual([{ rowNumber: 2, row: { name: "Alpha", note: "first" } }]);
  });

  it("parses a .csv file the same way as .xlsx", async () => {
    const target = makeFakeTarget();
    const buffer = buildCsvBuffer(["Name", "Note"], [["Alpha", "first"]]);

    const rows = await parseImportFile(target, buffer, "products.csv");

    expect(rows).toEqual([{ rowNumber: 2, row: { name: "Alpha", note: "first" } }]);
  });

  it("ignores a column in the file that the target doesn't recognize", async () => {
    const target = makeFakeTarget();
    const buffer = await buildXlsxBuffer(["name", "Unexpected Column"], [["Alpha", "ignored"]]);

    const rows = await parseImportFile(target, buffer, "products.xlsx");

    expect(rows).toEqual([{ rowNumber: 2, row: { name: "Alpha" } }]);
  });

  it("skips a fully blank row without shifting later row numbers", async () => {
    const target = makeFakeTarget();
    const buffer = await buildXlsxBuffer(["name", "note"], [["Alpha", "first"], ["", ""], ["Beta", "second"]]);

    const rows = await parseImportFile(target, buffer, "products.xlsx");

    expect(rows.map((r) => r.rowNumber)).toEqual([2, 4]);
  });

  it("rejects a file exceeding the 1,000-row cap before any resolution work begins", async () => {
    const target = makeFakeTarget();
    const dataRows = Array.from({ length: 1001 }, (_, i) => [`Row${i}`, ""]);
    const buffer = await buildXlsxBuffer(["name", "note"], dataRows);

    await expect(parseImportFile(target, buffer, "products.xlsx")).rejects.toThrow(/maximum per import is 1000/);
    expect(target.resolveRow).not.toHaveBeenCalled();
  });
});

describe("previewImport", () => {
  it("performs zero writes and separates valid/invalid rows with their reasons", async () => {
    const target = makeFakeTarget();
    const rows = [
      { rowNumber: 2, row: { name: "Alpha" } },
      { rowNumber: 3, row: { name: "" } },
    ];

    const result = await previewImport(target, rows, "company-a");

    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.rows).toEqual([
      { rowNumber: 2, status: "valid", errors: [], raw: { name: "Alpha" } },
      { rowNumber: 3, status: "invalid", errors: ["Name is required."], raw: { name: "" } },
    ]);
    expect(target.createRow).not.toHaveBeenCalled();
  });
});

describe("commitImport", () => {
  it("creates every valid row independently — one failing row never blocks the rest", async () => {
    const target = makeFakeTarget();
    const rows = [
      { rowNumber: 2, row: { name: "Alpha" } },
      { rowNumber: 3, row: { name: "FAILS_AT_COMMIT" } },
      { rowNumber: 4, row: { name: "Gamma" } },
    ];

    const report = await commitImport(target, rows, "company-a");

    expect(report.createdCount).toBe(2);
    expect(report.failedCount).toBe(1);
    expect(report.rows).toEqual([
      { rowNumber: 2, status: "created", recordId: "id-Alpha", raw: { name: "Alpha" } },
      { rowNumber: 3, status: "failed", error: "Duplicate product code.", raw: { name: "FAILS_AT_COMMIT" } },
      { rowNumber: 4, status: "created", recordId: "id-Gamma", raw: { name: "Gamma" } },
    ]);
    expect(target.createRow).toHaveBeenCalledTimes(3);
  });

  it("re-resolves every row rather than trusting a prior preview result — a row invalid at commit time is reported as failed, never created", async () => {
    const target = makeFakeTarget();
    const rows = [{ rowNumber: 2, row: { name: "DUPLICATE" } }];

    const report = await commitImport(target, rows, "company-a");

    expect(report.createdCount).toBe(0);
    expect(report.failedCount).toBe(1);
    expect(report.rows[0]).toMatchObject({ status: "failed", error: 'A row named "DUPLICATE" already exists.' });
    expect(target.createRow).not.toHaveBeenCalled();
  });

  it("re-enforces the 1,000-row cap independently of parseImportFile — commitImport is reachable directly (e.g. via commitImportAction) without ever going through parseImportFile", async () => {
    const target = makeFakeTarget();
    const rows = Array.from({ length: 1001 }, (_, i) => ({ rowNumber: i + 2, row: { name: `Row${i}` } }));

    await expect(commitImport(target, rows, "company-a")).rejects.toThrow(/maximum per import is 1000/);
    expect(target.resolveRow).not.toHaveBeenCalled();
  });
});

describe("buildImportTemplate", () => {
  it("produces a workbook with exactly the target's own declared columns as headers, plus one example row", async () => {
    const target = makeFakeTarget();

    const buffer = await buildImportTemplate(target);
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error — @types/node version skew between this project and exceljs's own bundled types, not a real type error.
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.getRow(1).getCell(1).value).toBe("Name *");
    expect(worksheet.getRow(1).getCell(2).value).toBe("Note");
    expect(worksheet.getRow(2).getCell(1).value).toBe("Sample");
  });
});

describe("buildImportErrorReport", () => {
  it("includes only the failed rows, in the template's column shape, plus an appended Error column", async () => {
    const target = makeFakeTarget();
    const report: ImportReport = {
      createdCount: 1,
      failedCount: 1,
      rows: [
        { rowNumber: 2, status: "created", recordId: "id-Alpha", raw: { name: "Alpha" } },
        { rowNumber: 3, status: "failed", error: "Duplicate.", raw: { name: "Beta", note: "x" } },
      ],
    };

    const buffer = await buildImportErrorReport(target, report);
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error — @types/node version skew between this project and exceljs's own bundled types, not a real type error.
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.rowCount).toBe(2);
    expect(worksheet.getRow(1).values).toEqual([undefined, "Row", "Name", "Note", "Error"]);
    expect(worksheet.getRow(2).values).toEqual([undefined, 3, "Beta", "x", "Duplicate."]);
  });
});
