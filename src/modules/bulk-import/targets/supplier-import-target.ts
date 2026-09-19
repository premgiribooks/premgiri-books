import { getSundryCreditorsSubtreeIds } from "@/modules/ledgers/utils/excluded-groups";
import { createSupplierSchema, type CreateSupplierInput } from "@/modules/suppliers/validation/supplier-schema";
import { supplierService } from "@/modules/suppliers/services/supplier-service";
import type { ImportColumn, ImportTarget, ResolvedRowResult } from "@/types/bulk-import";
import { getCell, getOptionalCell, parseOptionalNumber, parseRequiredNumber } from "@/modules/bulk-import/targets/import-cell-parsers";
import { resolveLedgerGroupByName } from "@/modules/bulk-import/targets/resolve-ledger-group";

export const SUPPLIER_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "displayName", header: "Display Name", required: true, example: "XYZ Distributors" },
  { key: "ledgerGroup", header: "Ledger Group", required: false, example: "Sundry Creditors" },
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
  { key: "creditDays", header: "Credit Days", required: false, example: "" },
  { key: "openingBalance", header: "Opening Balance", required: true, example: "0" },
  { key: "openingBalanceType", header: "Opening Balance Type (DEBIT/CREDIT)", required: true, example: "CREDIT" },
  { key: "description", header: "Description", required: false, example: "" },
];

export const supplierImportTarget: ImportTarget<CreateSupplierInput> = {
  key: "suppliers",
  label: "Suppliers",
  columns: SUPPLIER_IMPORT_COLUMNS,

  async resolveRow(rawRow, companyId, cache): Promise<ResolvedRowResult<CreateSupplierInput>> {
    const errors: string[] = [];

    const ledgerGroupId = await resolveLedgerGroupByName(
      getOptionalCell(rawRow, "ledgerGroup"),
      companyId,
      cache,
      "Sundry Creditors",
      getSundryCreditorsSubtreeIds,
      errors
    );

    const openingBalanceRaw = getCell(rawRow, "openingBalance");
    const candidate = {
      displayName: getCell(rawRow, "displayName"),
      ledgerGroupId,
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
      creditDays: parseOptionalNumber(getOptionalCell(rawRow, "creditDays"), "Credit days", errors),
      openingBalance: parseRequiredNumber(openingBalanceRaw, "Opening balance", errors) ?? 0,
      openingBalanceType: getCell(rawRow, "openingBalanceType").toUpperCase(),
      description: getOptionalCell(rawRow, "description"),
    };

    if (errors.length > 0) {
      return { status: "invalid", errors };
    }

    const parsed = createSupplierSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: "invalid", errors: parsed.error.issues.map((issue) => issue.message) };
    }

    return { status: "valid", input: parsed.data };
  },

  async createRow(resolvedInput) {
    const supplier = await supplierService.createSupplier(resolvedInput);
    return { id: supplier.id };
  },
};
