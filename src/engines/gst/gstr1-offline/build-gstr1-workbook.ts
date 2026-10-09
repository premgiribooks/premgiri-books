// Writes the GSTR-1 offline-tool import workbook (GSTR1_Excel_Workbook_Template
// V2.2 layout): exact sheet names, rows 1-3 = title + summary, row 4 = column
// headers, data from row 5. The offline tool locates sheets by name and data by
// that layout, so neither may drift. This is deliberately not
// exportToExcelBuffer — that helper owns its own header placement and sheet
// naming — but string cells still go through its formula-injection guard.

import ExcelJS from "exceljs";

import { sanitizeCellText } from "@/lib/excel-export";

import type { Gstr1OfflineData } from "./build-gstr1-rows";

export const GSTR1_OFFLINE_SHEET_NAMES = {
  B2CS: "b2cs",
  HSN_B2C: "hsn(b2c)",
  DOCS: "docs",
} as const;

const HEADER_ROW = 4;
const FIRST_DATA_ROW = 5;
const DECIMAL_FORMAT = "0.00";
const TEXT_FORMAT = "@";
const B2CS_SUMMARY_LAST_ROW = 1048576;
const HSN_SUMMARY_LAST_ROW = 2000;

const B2CS_HEADERS = ["Type", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"];
const HSN_HEADERS = [
  "HSN",
  "Description",
  "UQC",
  "Total Quantity",
  "Total Value",
  "Rate",
  "Taxable Value",
  "Integrated Tax Amount",
  "Central Tax Amount",
  "State/UT Tax Amount",
  "Cess Amount",
];
const DOCS_HEADERS = ["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"];

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function writeHeaderBlock(
  sheet: ExcelJS.Worksheet,
  title: string,
  headers: readonly string[],
  summary: ReadonlyArray<{ column: string; label: string; formula: string; result: number }>
): void {
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = { bold: true };
  for (const item of summary) {
    sheet.getCell(`${item.column}2`).value = item.label;
    sheet.getCell(`${item.column}3`).value = { formula: item.formula, result: item.result };
    sheet.getCell(`${item.column}3`).numFmt = DECIMAL_FORMAT;
  }
  const headerRow = sheet.getRow(HEADER_ROW);
  headers.forEach((header, index) => {
    headerRow.getCell(index + 1).value = header;
  });
  headerRow.font = { bold: true };
}

function setWidths(sheet: ExcelJS.Worksheet, widths: readonly number[]): void {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

function writeB2csSheet(workbook: ExcelJS.Workbook, rows: Gstr1OfflineData["b2cs"]): void {
  const sheet = workbook.addWorksheet(GSTR1_OFFLINE_SHEET_NAMES.B2CS);
  writeHeaderBlock(sheet, "Summary For B2CS(7)", B2CS_HEADERS, [
    { column: "E", label: "Total Taxable  Value", formula: `SUM(E${FIRST_DATA_ROW}:E${B2CS_SUMMARY_LAST_ROW})`, result: sum(rows.map((row) => row.taxableValue)) },
    { column: "F", label: "Total Cess", formula: `SUM(F${FIRST_DATA_ROW}:F${B2CS_SUMMARY_LAST_ROW})`, result: sum(rows.map((row) => row.cessAmount)) },
  ]);
  setWidths(sheet, [8, 38, 24, 8, 16, 14, 20]);

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(FIRST_DATA_ROW + index);
    excelRow.getCell(1).value = row.type;
    excelRow.getCell(2).value = sanitizeCellText(row.placeOfSupply);
    // Column 3 (Applicable % of Tax Rate) and 7 (E-Commerce GSTIN) stay blank.
    excelRow.getCell(4).value = row.ratePercent;
    excelRow.getCell(5).value = row.taxableValue;
    excelRow.getCell(6).value = row.cessAmount;
    excelRow.getCell(5).numFmt = DECIMAL_FORMAT;
    excelRow.getCell(6).numFmt = DECIMAL_FORMAT;
  });
}

function writeHsnSheet(workbook: ExcelJS.Workbook, rows: Gstr1OfflineData["hsnB2c"]): void {
  const sheet = workbook.addWorksheet(GSTR1_OFFLINE_SHEET_NAMES.HSN_B2C);
  const range = (column: string) => `${column}${FIRST_DATA_ROW}:${column}${HSN_SUMMARY_LAST_ROW}`;
  const totalFormula = (column: string) => `SUM(${range(column)})`;

  writeHeaderBlock(sheet, "Summary For HSN(12)", HSN_HEADERS, [
    {
      column: "A",
      label: "No. of HSN",
      formula: `SUMPRODUCT((${range("A")}<>"")/COUNTIF(${range("A")},${range("A")}&""))`,
      result: new Set(rows.map((row) => row.hsnCode)).size,
    },
    { column: "E", label: "Total Value", formula: totalFormula("E"), result: sum(rows.map((row) => row.totalValue)) },
    { column: "G", label: "Total Taxable Value", formula: totalFormula("G"), result: sum(rows.map((row) => row.taxableValue)) },
    { column: "H", label: "Total Integrated Tax", formula: totalFormula("H"), result: sum(rows.map((row) => row.integratedTax)) },
    { column: "I", label: "Total Central Tax", formula: totalFormula("I"), result: sum(rows.map((row) => row.centralTax)) },
    { column: "J", label: "Total State/UT Tax", formula: totalFormula("J"), result: sum(rows.map((row) => row.stateTax)) },
    { column: "K", label: "Total Cess", formula: totalFormula("K"), result: sum(rows.map((row) => row.cess)) },
  ]);
  sheet.getCell("A3").numFmt = "0";
  setWidths(sheet, [12, 34, 24, 15, 14, 8, 15, 20, 19, 20, 13]);

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(FIRST_DATA_ROW + index);
    // HSN is text so a leading zero (e.g. "0101") survives.
    excelRow.getCell(1).value = sanitizeCellText(row.hsnCode);
    excelRow.getCell(1).numFmt = TEXT_FORMAT;
    excelRow.getCell(2).value = sanitizeCellText(row.description);
    excelRow.getCell(3).value = row.uqc;
    excelRow.getCell(4).value = row.totalQuantity;
    excelRow.getCell(5).value = row.totalValue;
    excelRow.getCell(6).value = row.ratePercent;
    excelRow.getCell(7).value = row.taxableValue;
    excelRow.getCell(8).value = row.integratedTax;
    excelRow.getCell(9).value = row.centralTax;
    excelRow.getCell(10).value = row.stateTax;
    excelRow.getCell(11).value = row.cess;
    for (const column of [4, 5, 7, 8, 9, 10, 11]) {
      excelRow.getCell(column).numFmt = DECIMAL_FORMAT;
    }
  });
}

function writeDocsSheet(workbook: ExcelJS.Workbook, rows: Gstr1OfflineData["docs"]): void {
  const sheet = workbook.addWorksheet(GSTR1_OFFLINE_SHEET_NAMES.DOCS);
  writeHeaderBlock(sheet, "Summary of documents issued during the tax period (13)", DOCS_HEADERS, [
    { column: "D", label: "Total Number", formula: `SUM(D${FIRST_DATA_ROW}:D${B2CS_SUMMARY_LAST_ROW})`, result: sum(rows.map((row) => row.totalNumber)) },
    { column: "E", label: "Total Cancelled", formula: `SUM(E${FIRST_DATA_ROW}:E${B2CS_SUMMARY_LAST_ROW})`, result: sum(rows.map((row) => row.cancelled)) },
  ]);
  sheet.getCell("D3").numFmt = "0";
  sheet.getCell("E3").numFmt = "0";
  setWidths(sheet, [48, 20, 20, 14, 12]);

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(FIRST_DATA_ROW + index);
    excelRow.getCell(1).value = row.nature;
    excelRow.getCell(2).value = sanitizeCellText(row.srNoFrom);
    excelRow.getCell(3).value = sanitizeCellText(row.srNoTo);
    excelRow.getCell(2).numFmt = TEXT_FORMAT;
    excelRow.getCell(3).numFmt = TEXT_FORMAT;
    excelRow.getCell(4).value = row.totalNumber;
    excelRow.getCell(5).value = row.cancelled;
  });
}

/** Builds the three-sheet GSTR-1 import workbook (b2cs, hsn(b2c), docs). */
export async function buildGstr1OfflineWorkbook(data: Gstr1OfflineData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  writeB2csSheet(workbook, data.b2cs);
  writeHsnSheet(workbook, data.hsnB2c);
  writeDocsSheet(workbook, data.docs);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
