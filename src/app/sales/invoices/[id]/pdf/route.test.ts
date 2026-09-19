import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { SalesInvoiceDetail } from "@/types/sales-invoice";

import { GET } from "./route";

const {
  getSalesInvoiceMock,
  buildSalesInvoiceHtmlMock,
  renderHtmlToPdfMock,
  getCompanyMock,
  listBankAccountsMock,
  readCompanyLogoAsDataUriMock,
  errorMock,
  warnMock,
} = vi.hoisted(() => ({
  getSalesInvoiceMock: vi.fn(),
  buildSalesInvoiceHtmlMock: vi.fn(),
  renderHtmlToPdfMock: vi.fn(),
  getCompanyMock: vi.fn(),
  listBankAccountsMock: vi.fn(),
  readCompanyLogoAsDataUriMock: vi.fn(),
  errorMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("@/modules/sales-invoices/services/sales-invoice-service", () => ({
  salesInvoiceService: { getSalesInvoice: getSalesInvoiceMock },
}));
vi.mock("@/modules/sales-invoices/pdf/sales-invoice-pdf", () => ({
  buildSalesInvoiceHtml: buildSalesInvoiceHtmlMock,
}));
vi.mock("@/lib/pdf-generation", () => ({
  renderHtmlToPdf: renderHtmlToPdfMock,
}));
vi.mock("@/modules/company/services/company-service", () => ({
  companyService: { getCompany: getCompanyMock },
}));
vi.mock("@/modules/bank-accounts/services/bank-account-service", () => ({
  bankAccountService: { listBankAccounts: listBankAccountsMock },
}));
vi.mock("@/modules/company/services/company-logo-service", () => ({
  readCompanyLogoAsDataUri: readCompanyLogoAsDataUriMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock, warn: warnMock },
}));
// Mocked rather than imported for real: @/lib/current-user transitively
// imports @/lib/prisma, which throws at MODULE-IMPORT time if DATABASE_URL
// isn't set — true on a clean CI runner (build.yml's `pnpm test` step sets
// no DATABASE_URL, unlike its `pnpm run build` step) even though every
// assertion here only needs these two classes' identity for `instanceof`
// checks, never a real session/DB lookup. Found via a CI-only test failure
// this local `pnpm test` run couldn't reproduce (this dev machine already
// has a real DATABASE_URL configured).
vi.mock("@/lib/current-user", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
}));

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function baseInvoice(overrides: Partial<SalesInvoiceDetail> = {}): SalesInvoiceDetail {
  return {
    id: "inv-1",
    companyId: "company-1",
    invoiceNumber: "INV/2026/0001",
    status: "POSTED",
    ...overrides,
  } as SalesInvoiceDetail;
}

const FAKE_COMPANY: { id: string; companyName: string; logo: string | null } = {
  id: "company-1",
  companyName: "Acme Co",
  logo: null,
};
const FAKE_BANK_ACCOUNT = { id: "bank-1", bankName: "Axis Bank" };

describe("GET /sales/invoices/[id]/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompanyMock.mockResolvedValue(FAKE_COMPANY);
    listBankAccountsMock.mockResolvedValue([FAKE_BANK_ACCOUNT]);
    readCompanyLogoAsDataUriMock.mockResolvedValue(null);
    buildSalesInvoiceHtmlMock.mockReturnValue("<html></html>");
    renderHtmlToPdfMock.mockResolvedValue(Buffer.from("%PDF-fake"));
  });

  it("returns 404 when the invoice doesn't exist (or belongs to another company)", async () => {
    getSalesInvoiceMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Sales invoice not found." });
    expect(getCompanyMock).not.toHaveBeenCalled();
  });

  it("rejects a DRAFT invoice — the download URL is directly hittable regardless of the UI's own status gate", async () => {
    getSalesInvoiceMock.mockResolvedValue(baseInvoice({ status: "DRAFT" }));

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(400);
    expect(renderHtmlToPdfMock).not.toHaveBeenCalled();
    expect(getCompanyMock).not.toHaveBeenCalled();
  });

  it("maps AuthenticationError to 401", async () => {
    getSalesInvoiceMock.mockRejectedValue(new AuthenticationError());

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(401);
  });

  it("maps AuthorizationError to 403", async () => {
    getSalesInvoiceMock.mockRejectedValue(new AuthorizationError());

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(403);
  });

  it("maps a plain AppError to 400", async () => {
    getSalesInvoiceMock.mockRejectedValue(new AppError("Something about the invoice is invalid."));

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Something about the invoice is invalid." });
  });

  it("returns a generic 500 and logs a render failure — not just a getSalesInvoice failure", async () => {
    getSalesInvoiceMock.mockResolvedValue(baseInvoice());
    renderHtmlToPdfMock.mockRejectedValue(new Error("Chromium launch failed"));

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Something went wrong. Please try again." });
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it("returns the PDF with the correct A4 headers on success", async () => {
    getSalesInvoiceMock.mockResolvedValue(baseInvoice({ invoiceNumber: "INV/2026/0001" }));

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="INV_2026_0001.pdf"');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("%PDF-fake");
    expect(renderHtmlToPdfMock).toHaveBeenCalledWith(expect.any(String), { format: "A4" });
  });

  it("resolves the company by the invoice's own companyId and passes company/bankAccount/logo through to buildSalesInvoiceHtml", async () => {
    const invoice = baseInvoice({ companyId: "company-1" });
    getSalesInvoiceMock.mockResolvedValue(invoice);
    readCompanyLogoAsDataUriMock.mockResolvedValue("data:image/png;base64,ZmFrZQ==");

    await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(getCompanyMock).toHaveBeenCalledWith("company-1");
    expect(readCompanyLogoAsDataUriMock).toHaveBeenCalledWith(FAKE_COMPANY.logo);
    expect(buildSalesInvoiceHtmlMock).toHaveBeenCalledWith({
      salesInvoice: invoice,
      company: FAKE_COMPANY,
      bankAccount: FAKE_BANK_ACCOUNT,
      logoDataUri: "data:image/png;base64,ZmFrZQ==",
    });
  });

  it("passes the first active bank account when more than one exists", async () => {
    const secondBankAccount = { id: "bank-2", bankName: "HDFC Bank" } as never;
    listBankAccountsMock.mockResolvedValue([FAKE_BANK_ACCOUNT, secondBankAccount]);
    getSalesInvoiceMock.mockResolvedValue(baseInvoice());

    await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(buildSalesInvoiceHtmlMock).toHaveBeenCalledWith(expect.objectContaining({ bankAccount: FAKE_BANK_ACCOUNT }));
  });

  it("omits the bank account (null) instead of failing the whole PDF when the caller lacks accounting:view — the expected case, not logged", async () => {
    listBankAccountsMock.mockRejectedValue(new AuthorizationError("You do not have permission to view accounting."));
    getSalesInvoiceMock.mockResolvedValue(baseInvoice());

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(200);
    expect(buildSalesInvoiceHtmlMock).toHaveBeenCalledWith(expect.objectContaining({ bankAccount: null }));
    expect(warnMock).not.toHaveBeenCalled();
  });

  it("still omits the bank account on an unexpected (non-permission) failure, but logs it — an infrastructure failure must not be silently invisible", async () => {
    listBankAccountsMock.mockRejectedValue(new Error("connection to database failed"));
    getSalesInvoiceMock.mockResolvedValue(baseInvoice());

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(200);
    expect(buildSalesInvoiceHtmlMock).toHaveBeenCalledWith(expect.objectContaining({ bankAccount: null }));
    expect(warnMock).toHaveBeenCalledTimes(1);
  });

  it("passes company: null instead of failing when getCompany resolves to null", async () => {
    getCompanyMock.mockResolvedValue(null);
    getSalesInvoiceMock.mockResolvedValue(baseInvoice());

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(200);
    expect(readCompanyLogoAsDataUriMock).toHaveBeenCalledWith(null);
    expect(buildSalesInvoiceHtmlMock).toHaveBeenCalledWith(expect.objectContaining({ company: null }));
  });
});
