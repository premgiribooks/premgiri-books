import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { Gstr1OfflineData } from "./build-gstr1-rows";
import { buildGstr1OfflineWorkbook } from "./build-gstr1-workbook";

const DATA: Gstr1OfflineData = {
  b2cs: [
    { type: "OE", placeOfSupply: "27-Maharashtra", ratePercent: 5, taxableValue: 1000.5, cessAmount: 0 },
    { type: "OE", placeOfSupply: "29-Karnataka", ratePercent: 18, taxableValue: 250, cessAmount: 2 },
  ],
  hsnB2c: [
    {
      hsnCode: "0101",
      description: "Printed books",
      uqc: "NOS-NUMBERS",
      totalQuantity: 12,
      totalValue: 1050.53,
      ratePercent: 5,
      taxableValue: 1000.5,
      integratedTax: 0,
      centralTax: 25.01,
      stateTax: 25.01,
      cess: 0,
    },
    {
      hsnCode: "998314",
      description: "=HYPERLINK(\"http://evil\")",
      uqc: null,
      totalQuantity: null,
      totalValue: 118,
      ratePercent: 18,
      taxableValue: 100,
      integratedTax: 18,
      centralTax: 0,
      stateTax: 0,
      cess: 0,
    },
  ],
  docs: [{ nature: "Invoices for outward supply", srNoFrom: "PBD-2627-INV-001", srNoTo: "PBD-2627-INV-009", totalNumber: 9, cancelled: 1 }],
};

async function readWorkbook(data: Gstr1OfflineData): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const file = await buildGstr1OfflineWorkbook(data);
  // ExcelJS types `load` against its own Buffer interface, which Node's Buffer does not satisfy.
  await workbook.xlsx.load(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ExcelJS.Buffer);
  return workbook;
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number, columns: number): unknown[] {
  return Array.from({ length: columns }, (_, index) => {
    const value = sheet.getRow(rowNumber).getCell(index + 1).value;
    return value ?? null;
  });
}

describe("buildGstr1OfflineWorkbook", () => {
  it("contains exactly the three portal sheets, named as the template names them", async () => {
    const workbook = await readWorkbook(DATA);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["b2cs", "hsn(b2c)", "docs"]);
  });

  it("writes the title in row 1 and the template's column headers in row 4 of each sheet", async () => {
    const workbook = await readWorkbook(DATA);

    expect(workbook.getWorksheet("b2cs")?.getCell("A1").value).toBe("Summary For B2CS(7)");
    expect(rowValues(workbook.getWorksheet("b2cs")!, 4, 7)).toEqual([
      "Type",
      "Place Of Supply",
      "Applicable % of Tax Rate",
      "Rate",
      "Taxable Value",
      "Cess Amount",
      "E-Commerce GSTIN",
    ]);

    expect(workbook.getWorksheet("hsn(b2c)")?.getCell("A1").value).toBe("Summary For HSN(12)");
    expect(rowValues(workbook.getWorksheet("hsn(b2c)")!, 4, 11)).toEqual([
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
    ]);

    expect(workbook.getWorksheet("docs")?.getCell("A1").value).toBe("Summary of documents issued during the tax period (13)");
    expect(rowValues(workbook.getWorksheet("docs")!, 4, 5)).toEqual(["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"]);
  });

  it("starts b2cs data at row 5 with numeric rate/value cells and blank optional columns", async () => {
    const sheet = (await readWorkbook(DATA)).getWorksheet("b2cs")!;

    expect(rowValues(sheet, 5, 7)).toEqual(["OE", "27-Maharashtra", null, 5, 1000.5, 0, null]);
    expect(rowValues(sheet, 6, 7)).toEqual(["OE", "29-Karnataka", null, 18, 250, 2, null]);
  });

  it("keeps an HSN code with a leading zero as text and leaves service UQC/quantity blank", async () => {
    const sheet = (await readWorkbook(DATA)).getWorksheet("hsn(b2c)")!;

    expect(sheet.getCell("A5").value).toBe("0101");
    expect(rowValues(sheet, 6, 11)).toEqual(expect.arrayContaining(["998314"]));
    expect(sheet.getCell("C6").value).toBeNull();
    expect(sheet.getCell("D6").value).toBeNull();
  });

  it("neutralises a description that starts like a spreadsheet formula", async () => {
    const sheet = (await readWorkbook(DATA)).getWorksheet("hsn(b2c)")!;

    expect(sheet.getCell("B6").value).toBe("'=HYPERLINK(\"http://evil\")");
  });

  it("writes document series rows from row 5 with numeric counts", async () => {
    const sheet = (await readWorkbook(DATA)).getWorksheet("docs")!;

    expect(rowValues(sheet, 5, 5)).toEqual(["Invoices for outward supply", "PBD-2627-INV-001", "PBD-2627-INV-009", 9, 1]);
  });

  it("fills the row-3 summary totals the template shows above the headers", async () => {
    const workbook = await readWorkbook(DATA);
    const cellResult = (sheet: string, address: string) => {
      const value = workbook.getWorksheet(sheet)?.getCell(address).value as { result?: number } | null;
      return value?.result;
    };

    expect(cellResult("b2cs", "E3")).toBe(1250.5);
    expect(cellResult("b2cs", "F3")).toBe(2);
    expect(cellResult("hsn(b2c)", "A3")).toBe(2);
    expect(cellResult("hsn(b2c)", "G3")).toBe(1100.5);
    expect(cellResult("docs", "D3")).toBe(9);
    expect(cellResult("docs", "E3")).toBe(1);
  });

  it("produces valid, header-only sheets when there is no data", async () => {
    const workbook = await readWorkbook({ b2cs: [], hsnB2c: [], docs: [] });

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["b2cs", "hsn(b2c)", "docs"]);
    expect(workbook.getWorksheet("b2cs")?.getCell("A5").value).toBeNull();
  });
});
