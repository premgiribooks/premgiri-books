import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCompanyUserMock,
  hasPermissionMock,
  listProductsMock,
  listCustomersMock,
  listSuppliersMock,
  listSelectableLedgersMock,
  listSelectableLedgerGroupsForLedgerMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  hasPermissionMock: vi.fn(),
  listProductsMock: vi.fn(),
  listCustomersMock: vi.fn(),
  listSuppliersMock: vi.fn(),
  listSelectableLedgersMock: vi.fn(),
  listSelectableLedgerGroupsForLedgerMock: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ hasPermission: hasPermissionMock }));
vi.mock("@/modules/products/services/product-service", () => ({
  productService: { listProducts: listProductsMock },
}));
vi.mock("@/modules/customers/services/customer-service", () => ({
  customerService: { listCustomers: listCustomersMock },
}));
vi.mock("@/modules/suppliers/services/supplier-service", () => ({
  supplierService: { listSuppliers: listSuppliersMock },
}));
vi.mock("@/modules/ledgers/services/ledger-service", () => ({
  ledgerService: {
    listSelectableLedgers: listSelectableLedgersMock,
    listSelectableLedgerGroupsForLedger: listSelectableLedgerGroupsForLedgerMock,
  },
}));

import { globalSearchService } from "@/modules/search/services/global-search-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

function product(id: string, name: string) {
  return { id, name, productCode: `P-${id}` };
}

function customerRow(id: string, name: string) {
  return { id, mobileNumber: "9999999999", ledger: { name } };
}

function supplierRow(id: string, name: string) {
  return { id, mobileNumber: "8888888888", ledger: { name } };
}

const GENERAL_GROUP_ID = "22222222-2222-4222-8222-222222222222";
const RESERVED_GROUP_ID = "33333333-3333-4333-8333-333333333333"; // e.g. Sundry Debtors

function ledgerRow(id: string, name: string, ledgerGroupId: string = GENERAL_GROUP_ID) {
  return { id, name, ledgerGroupId, ledgerGroup: { name: "Indirect Expenses" } };
}

beforeEach(() => {
  getCurrentCompanyUserMock.mockReset();
  hasPermissionMock.mockReset();
  listProductsMock.mockReset();
  listCustomersMock.mockReset();
  listSuppliersMock.mockReset();
  listSelectableLedgersMock.mockReset();
  listSelectableLedgerGroupsForLedgerMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: COMPANY_ID, role: "Company Admin" });
  hasPermissionMock.mockResolvedValue(true);
  listProductsMock.mockResolvedValue([]);
  listCustomersMock.mockResolvedValue([]);
  listSuppliersMock.mockResolvedValue([]);
  listSelectableLedgersMock.mockResolvedValue([]);
  // Mirrors ledgerService's own reserved-group exclusion: only a general
  // (non Bank/Customer/Supplier) group is "editable" via Ledger Master.
  listSelectableLedgerGroupsForLedgerMock.mockResolvedValue([{ id: GENERAL_GROUP_ID, name: "Indirect Expenses" }]);
});

describe("globalSearchService.search", () => {
  it("rejects an empty/whitespace-only query before any fan-out call fires", async () => {
    const groups = await globalSearchService.search("   ");

    expect(groups).toEqual([]);
    expect(listProductsMock).not.toHaveBeenCalled();
    expect(listCustomersMock).not.toHaveBeenCalled();
    expect(listSuppliersMock).not.toHaveBeenCalled();
    expect(listSelectableLedgersMock).not.toHaveBeenCalled();
  });

  it("fans out to all four groups in parallel, in the fixed order, when both permissions are granted", async () => {
    listProductsMock.mockResolvedValue([product("p1", "Widget")]);
    listCustomersMock.mockResolvedValue([customerRow("c1", "Acme Co")]);
    listSuppliersMock.mockResolvedValue([supplierRow("s1", "Bolt Supplies")]);
    listSelectableLedgersMock.mockResolvedValue([ledgerRow("l1", "Acme Co")]);

    const groups = await globalSearchService.search("acme");

    expect(groups.map((group) => group.groupKey)).toEqual(["products", "customers", "suppliers", "ledgers"]);
    expect(listProductsMock).toHaveBeenCalledWith({ search: "acme", status: "active" });
    expect(listCustomersMock).toHaveBeenCalledWith({ search: "acme", status: "active" });
    expect(listSuppliersMock).toHaveBeenCalledWith({ search: "acme", status: "active" });
    expect(listSelectableLedgersMock).toHaveBeenCalledWith({ search: "acme" });
  });

  it("never passes a client-supplied company id — each target service resolves its own scope", async () => {
    await globalSearchService.search("acme");

    for (const call of [listProductsMock, listCustomersMock, listSuppliersMock, listSelectableLedgersMock]) {
      const [args] = call.mock.calls[0] as [Record<string, unknown>];
      expect(args).not.toHaveProperty("companyId");
    }
  });

  it("omits the Ledgers group for a user with masters:view but not accounting:view, and vice versa", async () => {
    hasPermissionMock.mockImplementation(async (_user: unknown, module: string) => module === "masters");

    const mastersOnly = await globalSearchService.search("acme");
    expect(mastersOnly.map((group) => group.groupKey)).toEqual(["products", "customers", "suppliers"]);
    expect(listSelectableLedgersMock).not.toHaveBeenCalled();

    hasPermissionMock.mockImplementation(async (_user: unknown, module: string) => module === "accounting");

    const accountingOnly = await globalSearchService.search("acme");
    expect(accountingOnly.map((group) => group.groupKey)).toEqual(["ledgers"]);
    expect(listProductsMock).toHaveBeenCalledTimes(1); // only from the masters-only call above
  });

  it("returns no groups for a user with neither masters:view nor accounting:view", async () => {
    hasPermissionMock.mockResolvedValue(false);

    const groups = await globalSearchService.search("acme");

    expect(groups).toEqual([]);
    expect(listProductsMock).not.toHaveBeenCalled();
    expect(listSelectableLedgersMock).not.toHaveBeenCalled();
  });

  it("caps each group at 5 items but reports the true totalMatches", async () => {
    listProductsMock.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => product(`p${index}`, `Widget ${index}`))
    );

    const groups = await globalSearchService.search("widget");
    const productsGroup = groups.find((group) => group.groupKey === "products");

    expect(productsGroup?.items).toHaveLength(5);
    expect(productsGroup?.totalMatches).toBe(8);
  });

  it("excludes detail-managed ledgers (Bank/Customer/Supplier-owned) from the Ledgers group", async () => {
    // The generic /accounting/ledgers/[id]/edit route this group links to
    // 404s for a ledger paired with a Customer/Supplier/BankAccount row
    // (ledgerService.getEditableLedger's own rule) — so a search hit here
    // must never include one, even though listSelectableLedgers itself
    // returns every active ledger regardless of its owning group.
    listSelectableLedgersMock.mockResolvedValue([
      ledgerRow("l1", "Acme Co (general ledger)", GENERAL_GROUP_ID),
      ledgerRow("l2", "Acme Co (customer ledger)", RESERVED_GROUP_ID),
    ]);

    const groups = await globalSearchService.search("acme");
    const ledgersGroup = groups.find((group) => group.groupKey === "ledgers");

    expect(ledgersGroup?.items).toHaveLength(1);
    expect(ledgersGroup?.items[0]?.id).toBe("l1");
    expect(ledgersGroup?.totalMatches).toBe(1);
  });

  it("does not let one group's failure blank out the others", async () => {
    listProductsMock.mockRejectedValue(new Error("transient db error"));
    listCustomersMock.mockResolvedValue([customerRow("c1", "Acme Co")]);

    const groups = await globalSearchService.search("acme");

    const productsGroup = groups.find((group) => group.groupKey === "products");
    const customersGroup = groups.find((group) => group.groupKey === "customers");
    expect(productsGroup?.items).toEqual([]);
    expect(productsGroup?.totalMatches).toBe(0);
    expect(customersGroup?.items).toHaveLength(1);
  });
});
