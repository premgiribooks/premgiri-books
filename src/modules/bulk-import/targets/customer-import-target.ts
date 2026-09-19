import { getSundryDebtorsSubtreeIds } from "@/modules/ledgers/utils/excluded-groups";
import { createCustomerSchema, type CreateCustomerInput } from "@/modules/customers/validation/customer-schema";
import { customerService } from "@/modules/customers/services/customer-service";
import type { ImportColumn, ImportTarget, ResolvedRowResult } from "@/types/bulk-import";
import { getCell, getOptionalCell, parseOptionalNumber, parseRequiredNumber } from "@/modules/bulk-import/targets/import-cell-parsers";
import { resolveLedgerGroupByName } from "@/modules/bulk-import/targets/resolve-ledger-group";

// Price List is deliberately excluded from the v1 import template — the
// same "not one of 76-excel-import.md's enumerated natural keys" reasoning
// as Products' gstRateId/marginProfileId omission; remains editable
// afterward via the existing Edit screen.
export const CUSTOMER_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "displayName", header: "Display Name", required: true, example: "ABC Traders" },
  { key: "ledgerGroup", header: "Ledger Group", required: false, example: "Sundry Debtors" },
  { key: "customerType", header: "Customer Type (RETAIL/WHOLESALE/DEALER/DISTRIBUTOR)", required: true, example: "RETAIL" },
  { key: "contactPerson", header: "Contact Person", required: false, example: "" },
  { key: "mobileNumber", header: "Mobile Number", required: false, example: "9876543210" },
  { key: "alternateMobile", header: "Alternate Mobile", required: false, example: "" },
  { key: "email", header: "Email", required: false, example: "" },
  { key: "gstin", header: "GSTIN", required: false, example: "" },
  { key: "pan", header: "PAN", required: false, example: "" },
  { key: "addressLine1", header: "Address Line 1", required: false, example: "" },
  { key: "addressLine2", header: "Address Line 2", required: false, example: "" },
  { key: "city", header: "City", required: false, example: "" },
  { key: "state", header: "State", required: false, example: "" },
  { key: "district", header: "District", required: false, example: "" },
  { key: "country", header: "Country", required: false, example: "" },
  { key: "pinCode", header: "PIN Code", required: false, example: "" },
  { key: "creditLimit", header: "Credit Limit", required: false, example: "" },
  { key: "creditDays", header: "Credit Days", required: false, example: "" },
  { key: "openingBalance", header: "Opening Balance", required: true, example: "0" },
  { key: "openingBalanceType", header: "Opening Balance Type (DEBIT/CREDIT)", required: true, example: "DEBIT" },
  { key: "description", header: "Description", required: false, example: "" },
];

export const customerImportTarget: ImportTarget<CreateCustomerInput> = {
  key: "customers",
  label: "Customers",
  columns: CUSTOMER_IMPORT_COLUMNS,

  async resolveRow(rawRow, companyId, cache): Promise<ResolvedRowResult<CreateCustomerInput>> {
    const errors: string[] = [];

    const ledgerGroupId = await resolveLedgerGroupByName(
      getOptionalCell(rawRow, "ledgerGroup"),
      companyId,
      cache,
      "Sundry Debtors",
      getSundryDebtorsSubtreeIds,
      errors
    );

    const openingBalanceRaw = getCell(rawRow, "openingBalance");
    const candidate = {
      displayName: getCell(rawRow, "displayName"),
      ledgerGroupId,
      customerType: getCell(rawRow, "customerType").toUpperCase(),
      contactPerson: getOptionalCell(rawRow, "contactPerson"),
      mobileNumber: getOptionalCell(rawRow, "mobileNumber"),
      alternateMobile: getOptionalCell(rawRow, "alternateMobile"),
      email: getOptionalCell(rawRow, "email"),
      gstin: getOptionalCell(rawRow, "gstin"),
      pan: getOptionalCell(rawRow, "pan"),
      addressLine1: getOptionalCell(rawRow, "addressLine1"),
      addressLine2: getOptionalCell(rawRow, "addressLine2"),
      city: getOptionalCell(rawRow, "city"),
      state: getOptionalCell(rawRow, "state"),
      district: getOptionalCell(rawRow, "district"),
      country: getOptionalCell(rawRow, "country"),
      pinCode: getOptionalCell(rawRow, "pinCode"),
      creditLimit: parseOptionalNumber(getOptionalCell(rawRow, "creditLimit"), "Credit limit", errors),
      creditDays: parseOptionalNumber(getOptionalCell(rawRow, "creditDays"), "Credit days", errors),
      openingBalance: parseRequiredNumber(openingBalanceRaw, "Opening balance", errors) ?? 0,
      openingBalanceType: getCell(rawRow, "openingBalanceType").toUpperCase(),
      description: getOptionalCell(rawRow, "description"),
    };

    if (errors.length > 0) {
      return { status: "invalid", errors };
    }

    const parsed = createCustomerSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: "invalid", errors: parsed.error.issues.map((issue) => issue.message) };
    }

    return { status: "valid", input: parsed.data };
  },

  async createRow(resolvedInput) {
    const customer = await customerService.createCustomer(resolvedInput);
    return { id: customer.id };
  },
};
