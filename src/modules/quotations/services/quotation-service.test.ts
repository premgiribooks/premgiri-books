import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors voucher-engine.test.ts's convention — mock the module-boundary
// repository, sibling services/engines, and the session/permission/Prisma
// boundaries; the GST Engine itself is left REAL so the engine-composition
// test is a genuine end-to-end check, not a mock echoing back its own input.
const {
  findManyMock,
  findByIdMock,
  createMock,
  replaceItemsAndUpdateMock,
  updateStatusMock,
  expireOverdueMock,
  findQuotableProductsMock,
  findProductsForLinesMock,
  findCustomerForQuotationMock,
  findCompanyStateCodeMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  ensureSequenceMock,
  generateNumberMock,
  previewNextNumberMock,
  listSelectableCustomersMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  createMock: vi.fn(),
  replaceItemsAndUpdateMock: vi.fn(),
  updateStatusMock: vi.fn(),
  expireOverdueMock: vi.fn(),
  findQuotableProductsMock: vi.fn(),
  findProductsForLinesMock: vi.fn(),
  findCustomerForQuotationMock: vi.fn(),
  findCompanyStateCodeMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  previewNextNumberMock: vi.fn(),
  listSelectableCustomersMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/quotations/repositories/quotation-repository", () => ({
  quotationRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    updateStatus: updateStatusMock,
    expireOverdue: expireOverdueMock,
    findQuotableProducts: findQuotableProductsMock,
    findProductsForLines: findProductsForLinesMock,
    findCustomerForQuotation: findCustomerForQuotationMock,
    findCompanyStateCode: findCompanyStateCodeMock,
  },
}));

vi.mock("@/lib/current-user", () => ({
  getCurrentCompanyUser: getCurrentCompanyUserMock,
}));

vi.mock("@/lib/current-financial-year", () => ({
  getCurrentFinancialYear: getCurrentFinancialYearMock,
}));

vi.mock("@/lib/permissions", () => ({
  assertPermission: assertPermissionMock,
}));

vi.mock("@/engines/document-number/document-number-engine", () => ({
  documentNumberEngine: {
    ensureSequence: ensureSequenceMock,
    generateNumber: generateNumberMock,
    previewNextNumber: previewNextNumberMock,
  },
}));

vi.mock("@/modules/customers/services/customer-service", () => ({
  customerService: { listSelectableCustomers: listSelectableCustomersMock },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { AppError } from "@/lib/app-error";
import { quotationService } from "@/modules/quotations/services/quotation-service";
import type { QuotationLineInput } from "@/modules/quotations/validation/quotation-schema";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_A_ID = "55555555-5555-4555-8555-555555555555";
const PRODUCT_B_ID = "66666666-6666-4666-8666-666666666666";

const CURRENT_USER = {
  id: USER_ID,
  username: "admin",
  fullName: "Admin",
  userType: "COMPANY" as const,
  role: "Company Admin",
  companyId: COMPANY_ID,
};

const CURRENT_FY = {
  id: FY_ID,
  companyId: COMPANY_ID,
  name: "2026-2027",
  startDate: new Date("2026-04-01T00:00:00.000Z"),
  endDate: new Date("2027-03-31T00:00:00.000Z"),
  isCurrent: true,
  isClosed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ACTIVE_CUSTOMER = { id: CUSTOMER_ID, companyId: COMPANY_ID, isActive: true, priceListId: null };

// Product A: 18% GST, 0% cess. Product B: 5% GST, 1% cess.
const PRODUCT_A = {
  id: PRODUCT_A_ID,
  name: "Product A",
  productCode: "A",
  isActive: true,
  unitSymbol: "Nos",
  unitDecimalPlaces: 0,
  hsnCode: "1234",
  hasGstRate: true,
  ratePercent: 18,
  cessPercent: 0,
  sellingPrice: 100,
  purchasePrice: 50,
};
const PRODUCT_B = {
  id: PRODUCT_B_ID,
  name: "Product B",
  productCode: "B",
  isActive: true,
  unitSymbol: "Nos",
  unitDecimalPlaces: 0,
  hsnCode: "5678",
  hasGstRate: true,
  ratePercent: 5,
  cessPercent: 1,
  sellingPrice: 1000,
  purchasePrice: 900,
};

function validLines(): QuotationLineInput[] {
  return [
    { productId: PRODUCT_A_ID, quantity: 2, rate: 100, discountPercent: undefined, discountAmount: undefined },
    { productId: PRODUCT_B_ID, quantity: 1, rate: 1000, discountPercent: 10, discountAmount: undefined },
  ];
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    customerId: CUSTOMER_ID,
    quotationDate: "2026-09-10",
    validUntil: undefined,
    placeOfSupplyStateCode: "27",
    narration: undefined,
    lines: validLines(),
    ...overrides,
  };
}

function quotationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-1",
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    quotationNumber: "QTN-0001",
    status: "DRAFT",
    ...overrides,
  };
}

beforeEach(() => {
  findManyMock.mockReset();
  findByIdMock.mockReset();
  createMock.mockReset();
  replaceItemsAndUpdateMock.mockReset();
  updateStatusMock.mockReset();
  expireOverdueMock.mockReset();
  findQuotableProductsMock.mockReset();
  findProductsForLinesMock.mockReset();
  findCustomerForQuotationMock.mockReset();
  findCompanyStateCodeMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  getCurrentFinancialYearMock.mockReset();
  assertPermissionMock.mockReset();
  ensureSequenceMock.mockReset();
  generateNumberMock.mockReset();
  previewNextNumberMock.mockReset();
  listSelectableCustomersMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue(CURRENT_FY);
  assertPermissionMock.mockResolvedValue(undefined);
  findCustomerForQuotationMock.mockResolvedValue(ACTIVE_CUSTOMER);
  findCompanyStateCodeMock.mockResolvedValue("27");
  findProductsForLinesMock.mockResolvedValue([PRODUCT_A, PRODUCT_B]);
  generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "QTN-0001" });
  createMock.mockResolvedValue(quotationRow());
  expireOverdueMock.mockResolvedValue(undefined);
});

describe("createQuotation — engine composition", () => {
  it("produces per-line and header totals matching a hand-computed mixed-rate, mixed-cess fixture (intra-state)", async () => {
    await quotationService.createQuotation(validInput());

    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "QUOTATION");
    expect(generateNumberMock).toHaveBeenCalledWith(FAKE_TX, {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      documentType: "QUOTATION",
    });

    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({
        subtotal: 1200,
        totalDiscount: 100,
        taxableAmount: 1100,
        totalCgst: 40.5,
        totalSgst: 40.5,
        totalIgst: 0,
        totalCess: 9,
        grandTotal: 1190,
      }),
      [
        expect.objectContaining({
          productId: PRODUCT_A_ID,
          taxableAmount: 200,
          cgst: 18,
          sgst: 18,
          igst: 0,
          cess: 0,
          totalAmount: 236,
        }),
        expect.objectContaining({
          productId: PRODUCT_B_ID,
          taxableAmount: 900,
          cgst: 22.5,
          sgst: 22.5,
          igst: 0,
          cess: 9,
          totalAmount: 954,
        }),
      ],
      { documentSequenceId: "seq-1", number: 1, formatted: "QTN-0001" },
      USER_ID
    );
  });

  it("produces IGST instead of CGST/SGST for an inter-state supply", async () => {
    findCompanyStateCodeMock.mockResolvedValueOnce("07"); // Delhi vs place of supply "27" Maharashtra

    await quotationService.createQuotation(validInput());

    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ totalCgst: 0, totalSgst: 0, totalIgst: 81 }),
      expect.any(Array),
      expect.any(Object),
      USER_ID
    );
  });
});

describe("createQuotation — validation and scoping", () => {
  it("rejects when the customer does not exist or belongs to another company", async () => {
    findCustomerForQuotationMock.mockResolvedValueOnce(null);
    await expect(quotationService.createQuotation(validInput())).rejects.toThrow("Customer not found.");
    expect(ensureSequenceMock).not.toHaveBeenCalled();
  });

  it("rejects when the customer is inactive", async () => {
    findCustomerForQuotationMock.mockResolvedValueOnce({ ...ACTIVE_CUSTOMER, isActive: false });
    await expect(quotationService.createQuotation(validInput())).rejects.toThrow(
      "Selected customer is inactive."
    );
  });

  it("rejects when a line's product does not exist or belongs to another company", async () => {
    findProductsForLinesMock.mockResolvedValueOnce([PRODUCT_A]); // PRODUCT_B missing
    await expect(quotationService.createQuotation(validInput())).rejects.toThrow(
      "One or more products were not found."
    );
  });

  it("rejects when the company has no GST state code set", async () => {
    findCompanyStateCodeMock.mockResolvedValueOnce(null);
    await expect(quotationService.createQuotation(validInput())).rejects.toThrow(
      "Set your company's GST state"
    );
  });

  it("rejects a quotation whose lines are all zero-value", async () => {
    const zeroLine: QuotationLineInput = {
      productId: PRODUCT_A_ID,
      quantity: 1,
      rate: 100,
      discountPercent: 100,
      discountAmount: undefined,
    };
    await expect(
      quotationService.createQuotation(validInput({ lines: [zeroLine] }))
    ).rejects.toThrow("A quotation cannot consist entirely of zero-value lines.");
  });

  it("translates a document-number unique-constraint collision into a friendly message", async () => {
    createMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.8.0",
        meta: { target: ["quotationNumber"] },
      })
    );
    await expect(quotationService.createQuotation(validInput())).rejects.toThrow(
      "A quotation with this number already exists for this financial year."
    );
  });

  it("every rejection is an AppError, safe to surface to the client", async () => {
    findCustomerForQuotationMock.mockResolvedValueOnce(null);
    await expect(quotationService.createQuotation(validInput())).rejects.toBeInstanceOf(AppError);
  });
});

describe("status transition matrix", () => {
  it("sendQuotation: DRAFT -> SENT succeeds", async () => {
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(quotationRow({ status: "SENT" }));
    const result = await quotationService.sendQuotation("q-1");
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), "q-1", COMPANY_ID, ["DRAFT"], "SENT");
    expect(result.status).toBe("SENT");
  });

  it("sendQuotation: rejects when the quotation is not currently DRAFT", async () => {
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(quotationService.sendQuotation("q-1")).rejects.toThrow(
      "This quotation can no longer be changed"
    );
  });

  it("acceptQuotation: SENT -> ACCEPTED succeeds and lazily expires first", async () => {
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(quotationRow({ status: "ACCEPTED" }));
    await quotationService.acceptQuotation("q-1");
    expect(expireOverdueMock).toHaveBeenCalledWith(COMPANY_ID, expect.any(Date), "q-1");
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), "q-1", COMPANY_ID, ["SENT"], "ACCEPTED");
  });

  it("acceptQuotation: rejects a quotation that just lazily expired (same friendly message as terminal state)", async () => {
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(quotationService.acceptQuotation("q-1")).rejects.toThrow(
      "This quotation can no longer be changed"
    );
  });

  it("rejectQuotation: SENT -> REJECTED succeeds", async () => {
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(quotationRow({ status: "REJECTED" }));
    await quotationService.rejectQuotation("q-1");
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), "q-1", COMPANY_ID, ["SENT"], "REJECTED");
  });

  it.each(["DRAFT", "SENT"])("cancelQuotation: %s -> CANCELLED succeeds", async () => {
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(quotationRow({ status: "CANCELLED" }));
    await quotationService.cancelQuotation("q-1");
    expect(updateStatusMock).toHaveBeenCalledWith(
      expect.anything(),
      "q-1",
      COMPANY_ID,
      ["DRAFT", "SENT"],
      "CANCELLED"
    );
  });

  it("cancelQuotation: rejects an already-terminal quotation", async () => {
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(quotationService.cancelQuotation("q-1")).rejects.toThrow(
      "This quotation can no longer be changed"
    );
  });
});

describe("updateQuotation — terminal-state immutability", () => {
  it.each(["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"])(
    "rejects updating a %s quotation",
    async (status) => {
      findByIdMock.mockResolvedValueOnce(quotationRow({ status }));
      await expect(quotationService.updateQuotation("q-1", validInput())).rejects.toThrow(
        "This quotation can no longer be changed"
      );
      expect(replaceItemsAndUpdateMock).not.toHaveBeenCalled();
    }
  );

  it.each(["DRAFT", "SENT"])("allows updating a %s quotation", async (status) => {
    findByIdMock.mockResolvedValueOnce(quotationRow({ status }));
    replaceItemsAndUpdateMock.mockResolvedValueOnce(quotationRow({ status }));
    await quotationService.updateQuotation("q-1", validInput());
    expect(replaceItemsAndUpdateMock).toHaveBeenCalledWith(
      FAKE_TX,
      "q-1",
      COMPANY_ID,
      ["DRAFT", "SENT"],
      expect.any(Object),
      expect.any(Array)
    );
  });

  it("rejects when the quotation belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(quotationRow({ companyId: OTHER_COMPANY_ID }));
    await expect(quotationService.updateQuotation("q-1", validInput())).rejects.toThrow(
      "Quotation not found."
    );
  });
});

describe("getQuotation / listQuotations — cross-company and lazy expiry", () => {
  it("getQuotation returns null for a cross-company quotation", async () => {
    findByIdMock.mockResolvedValueOnce(quotationRow({ companyId: OTHER_COMPANY_ID }));
    await expect(quotationService.getQuotation("q-1")).resolves.toBeNull();
  });

  it("getQuotation lazily expires the row before reading it", async () => {
    findByIdMock.mockResolvedValueOnce(quotationRow());
    await quotationService.getQuotation("q-1");
    expect(expireOverdueMock).toHaveBeenCalledWith(COMPANY_ID, expect.any(Date), "q-1");
  });

  it("listQuotations lazily expires before listing and returns [] with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await quotationService.listQuotations();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
