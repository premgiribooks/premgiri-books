import { describe, expect, it } from "vitest";

import { toCompanyFormValues } from "@/modules/company/utils/company-form-values";
import type { Company } from "@prisma/client";

function buildCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "company-1",
    companyName: "Acme Traders",
    legalName: "Acme Traders Pvt Ltd",
    displayName: null,
    businessType: null,
    gstin: null,
    pan: null,
    tan: null,
    cin: null,
    mobileNumber: null,
    alternateMobile: null,
    email: null,
    website: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    stateCode: null,
    district: null,
    country: "India",
    pinCode: null,
    currency: "INR",
    currencySymbol: "₹",
    decimalPlaces: 2,
    logo: null,
    termsAndConditions: null,
    timeZone: "Asia/Kolkata",
    isActive: true,
    bootstrapVersion: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Company;
}

describe("toCompanyFormValues", () => {
  // Regression coverage for a bug caught 2026-09-19 during code review: this
  // function is the sole source of an edit form's defaultValues (both
  // /administration/companies/[id]/edit and /company/[id]/edit), so any
  // Company column it forgets to map renders blank on every edit-form load
  // regardless of what's actually stored — and since the Textarea/Input
  // controls default a missing value to "", the NEXT unrelated save silently
  // overwrites the real, previously-saved value with null. Asserting every
  // mapped key here (not just termsAndConditions) so this class of bug can't
  // recur unnoticed for any future Company column either.
  it("maps every optional Company column the edit forms need, including termsAndConditions", () => {
    const company = buildCompany({
      displayName: "Acme",
      businessType: "Retail",
      gstin: "27AACCT3705E1ZQ",
      pan: "AACCT3705E",
      tan: "TAN1234",
      cin: "CIN1234",
      mobileNumber: "9876543210",
      alternateMobile: "9876543211",
      email: "acme@example.com",
      website: "https://acme.example",
      addressLine1: "1st Cross",
      addressLine2: "HSR Layout",
      city: "Bangalore",
      state: "Karnataka",
      district: "Bangalore Urban",
      pinCode: "560102",
      logo: "/uploads/logos/abc.png",
      termsAndConditions: "Goods once sold will not be taken back.",
    });

    const values = toCompanyFormValues(company);

    expect(values).toMatchObject({
      companyName: "Acme Traders",
      legalName: "Acme Traders Pvt Ltd",
      displayName: "Acme",
      businessType: "Retail",
      gstin: "27AACCT3705E1ZQ",
      pan: "AACCT3705E",
      tan: "TAN1234",
      cin: "CIN1234",
      mobileNumber: "9876543210",
      alternateMobile: "9876543211",
      email: "acme@example.com",
      website: "https://acme.example",
      addressLine1: "1st Cross",
      addressLine2: "HSR Layout",
      city: "Bangalore",
      state: "Karnataka",
      district: "Bangalore Urban",
      country: "India",
      pinCode: "560102",
      currency: "INR",
      currencySymbol: "₹",
      decimalPlaces: 2,
      logo: "/uploads/logos/abc.png",
      termsAndConditions: "Goods once sold will not be taken back.",
    });
  });

  it("maps a null termsAndConditions to undefined, not null or a missing key — matching every other optional field's convention", () => {
    const values = toCompanyFormValues(buildCompany({ termsAndConditions: null }));

    expect(values).toHaveProperty("termsAndConditions", undefined);
  });
});
