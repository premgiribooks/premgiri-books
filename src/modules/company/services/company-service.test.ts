import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression coverage for the updateCompanyProfile bug found 2026-09-10
// while setting up feature-spec 36 (Sales Orders): `merged` used to spread
// the ENTIRE `existing` CompanyWithSettings row (including `id`,
// `createdAt`, `updatedAt`, `bootstrapVersion`, and the raw nested
// `settings` relation row) into the object handed to
// `companyRepository.update()` / `prisma.company.update({ data: ... })`,
// which Prisma's typed client rejects at runtime ("Unknown argument `id`"
// under the nested `settings` object) — TypeScript's excess-property check
// does not catch this because the extra fields arrive via a variable
// spread, not an object literal's own keys.
const { findByIdMock, updateMock, getCurrentCompanyUserMock, assertPermissionMock } = vi.hoisted(() => ({
  findByIdMock: vi.fn(),
  updateMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
}));

vi.mock("@/modules/company/repositories/company-repository", () => ({
  companyRepository: {
    findById: findByIdMock,
    update: updateMock,
  },
}));

vi.mock("@/lib/current-user", () => ({
  getCurrentCompanyUser: getCurrentCompanyUserMock,
  getCurrentSuperAdmin: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  assertPermission: assertPermissionMock,
}));

// company-service.ts imports runInTransaction (@/lib/transaction), which
// imports the real @/lib/prisma singleton — that module throws at import
// time if DATABASE_URL isn't set (it isn't, in this test environment).
// updateCompanyProfile itself never calls $transaction, so a bare mock is
// enough (mirrors quotation-service.test.ts's identical need).
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({}) },
}));

import { companyService } from "@/modules/company/services/company-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const CURRENT_USER = {
  id: USER_ID,
  username: "admin",
  fullName: "Admin",
  userType: "COMPANY" as const,
  role: "Company Admin",
  companyId: COMPANY_ID,
};

const EXISTING_COMPANY = {
  id: COMPANY_ID,
  companyName: "Baba Premgiri Paints",
  legalName: "Baba Premgiri Paints",
  displayName: "Baba Premgiri Paints",
  businessType: "Other",
  gstin: "08CSWPP3893C1Z0",
  pan: "CSWPP3893C",
  tan: null,
  cin: null,
  mobileNumber: "9680229436",
  alternateMobile: null,
  email: "old@example.com",
  website: null,
  addressLine1: "Old Address",
  addressLine2: null,
  city: "Old City",
  state: "Rajasthan",
  stateCode: null,
  district: "Churu",
  country: "India",
  pinCode: "331403",
  currency: "INR",
  currencySymbol: "₹",
  decimalPlaces: 2,
  logo: null,
  termsAndConditions: "Goods once sold will not be taken back.",
  timeZone: "Asia/Kolkata",
  isActive: true,
  bootstrapVersion: 1,
  createdAt: new Date("2026-07-11T17:09:32.274Z"),
  updatedAt: new Date("2026-07-11T17:09:32.274Z"),
  settings: {
    id: "33333333-3333-4333-8333-333333333333",
    companyId: COMPANY_ID,
    defaultTheme: "dark",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
    numberFormat: "en-IN",
    currencyFormat: "INR",
    allowNegativeStock: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

function profileInput(overrides: Record<string, unknown> = {}) {
  return {
    companyName: "Baba Premgiri Paints",
    displayName: "Baba Premgiri Paints",
    businessType: "Other",
    mobileNumber: "9680229436",
    alternateMobile: undefined,
    email: "kamleshprajapat858@gmail.com",
    website: "https://www.premgiribooks.com",
    addressLine1: "Motor market ratanghar road",
    addressLine2: undefined,
    city: "Sardarshahar",
    state: "Rajasthan",
    stateCode: "08",
    district: "Churu",
    country: "India",
    pinCode: "331403",
    currencySymbol: "₹",
    decimalPlaces: 2,
    logo: undefined,
    termsAndConditions: "Payment due within 30 days.",
    ...overrides,
  };
}

beforeEach(() => {
  findByIdMock.mockReset();
  updateMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  assertPermissionMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  assertPermissionMock.mockResolvedValue(undefined);
  findByIdMock.mockResolvedValue(EXISTING_COMPANY);
  updateMock.mockResolvedValue(EXISTING_COMPANY);
});

describe("updateCompanyProfile", () => {
  it("never passes the nested settings relation, id, createdAt, updatedAt, or bootstrapVersion to the repository", async () => {
    await companyService.updateCompanyProfile(COMPANY_ID, profileInput());

    expect(updateMock).toHaveBeenCalledTimes(1);
    const persistData = updateMock.mock.calls[0][1] as Record<string, unknown>;

    expect(persistData).not.toHaveProperty("settings");
    expect(persistData).not.toHaveProperty("id");
    expect(persistData).not.toHaveProperty("createdAt");
    expect(persistData).not.toHaveProperty("updatedAt");
    expect(persistData).not.toHaveProperty("bootstrapVersion");
  });

  it("persists the new GST State (stateCode) from the submitted profile", async () => {
    await companyService.updateCompanyProfile(COMPANY_ID, profileInput({ stateCode: "08" }));

    const persistData = updateMock.mock.calls[0][1] as Record<string, unknown>;
    expect(persistData.stateCode).toBe("08");
  });

  it("preserves the six compliance-only fields from the existing row, unaffected by the profile input", async () => {
    await companyService.updateCompanyProfile(COMPANY_ID, profileInput());

    const persistData = updateMock.mock.calls[0][1] as Record<string, unknown>;
    expect(persistData.legalName).toBe(EXISTING_COMPANY.legalName);
    expect(persistData.gstin).toBe(EXISTING_COMPANY.gstin);
    expect(persistData.pan).toBe(EXISTING_COMPANY.pan);
    expect(persistData.tan).toBe(EXISTING_COMPANY.tan);
    expect(persistData.cin).toBe(EXISTING_COMPANY.cin);
    expect(persistData.currency).toBe(EXISTING_COMPANY.currency);
  });

  it("persists the submitted Terms & Conditions text, and stores a blank value as null (not empty string)", async () => {
    await companyService.updateCompanyProfile(COMPANY_ID, profileInput({ termsAndConditions: "New terms." }));
    expect((updateMock.mock.calls[0][1] as Record<string, unknown>).termsAndConditions).toBe("New terms.");

    await companyService.updateCompanyProfile(COMPANY_ID, profileInput({ termsAndConditions: "" }));
    expect((updateMock.mock.calls[1][1] as Record<string, unknown>).termsAndConditions).toBeNull();
  });

  it("rejects when the acting user does not belong to the target company", async () => {
    getCurrentCompanyUserMock.mockResolvedValueOnce({ ...CURRENT_USER, companyId: "other-company" });
    await expect(companyService.updateCompanyProfile(COMPANY_ID, profileInput())).rejects.toThrow(
      "Company not found."
    );
  });
});
