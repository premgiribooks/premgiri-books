import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { customerService } from "@/modules/customers/services/customer-service";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import { productService } from "@/modules/products/services/product-service";
import { supplierService } from "@/modules/suppliers/services/supplier-service";
import { globalSearchQuerySchema } from "@/modules/search/validation/global-search-schema";
import type { GlobalSearchGroup, GlobalSearchGroupKey, GlobalSearchItem } from "@/types/global-search";

const RESULTS_PER_GROUP = 5;

// A transient failure fetching one group (e.g. a DB hiccup) must not blank
// out the other groups' results — mirrors the resilience the prior ad-hoc
// src/lib/global-search.ts already established, now with permission
// filtering handled up front instead of caught here.
async function safeSearch<T>(run: () => Promise<T[]>): Promise<T[]> {
  try {
    return await run();
  } catch {
    return [];
  }
}

function toGroup<T>(
  groupKey: GlobalSearchGroupKey,
  groupLabel: string,
  rows: readonly T[],
  toItem: (row: T) => GlobalSearchItem
): GlobalSearchGroup {
  return {
    groupKey,
    groupLabel,
    totalMatches: rows.length,
    items: rows.slice(0, RESULTS_PER_GROUP).map(toItem),
  };
}

/**
 * 75-global-search.md's Global Search module. Owns no table and no query
 * logic of its own — it fans out, in parallel, to each in-scope master's own
 * already-existing `search`-capable list method and shapes the combined
 * result for display (Invariant 5: never query another module's data
 * directly). Products/Customers/Suppliers live under the `masters`
 * permission module; Ledgers live under `accounting` — so each group is
 * gated independently rather than behind one blanket check, or a user with
 * `accounting:view` but not `masters:view` (or vice versa) would either leak
 * or lose an entire group.
 */
export const globalSearchService = {
  async search(rawQuery: string): Promise<GlobalSearchGroup[]> {
    const parsed = globalSearchQuerySchema.safeParse({ query: rawQuery });
    if (!parsed.success) {
      // Empty/whitespace-only (or over-length) query — reject before any
      // fan-out call fires, never trusting the client's own debounce/empty
      // skip alone.
      return [];
    }
    const { query } = parsed.data;

    const user = await getCurrentCompanyUser();
    const [canViewMasters, canViewAccounting] = await Promise.all([
      hasPermission(user, "masters", "view"),
      hasPermission(user, "accounting", "view"),
    ]);

    const [products, customers, suppliers, ledgers] = await Promise.all([
      canViewMasters
        ? safeSearch(() => productService.listProducts({ search: query, status: "active" }))
        : null,
      canViewMasters
        ? safeSearch(() => customerService.listCustomers({ search: query, status: "active" }))
        : null,
      canViewMasters
        ? safeSearch(() => supplierService.listSuppliers({ search: query, status: "active" }))
        : null,
      // listSelectableLedgers always forces status: "active" itself (its
      // filters type omits `status` entirely), so "Active-only by default"
      // holds here with no explicit status passed. Also excludes ledgers
      // under a reserved group (Bank/Customer/Supplier) — those are
      // "detail-managed" (ledgerService.getEditableLedger's term): the
      // generic /accounting/ledgers/[id]/edit route this group links to
      // 404s for them by design, since their fields only change through
      // Bank/Customer/Supplier Management's own combined form. Customers
      // and Suppliers already have their own search group above, so this
      // also avoids surfacing the same party twice under two labels.
      canViewAccounting
        ? safeSearch(async () => {
            const [ledgerRows, editableGroups] = await Promise.all([
              ledgerService.listSelectableLedgers({ search: query }),
              ledgerService.listSelectableLedgerGroupsForLedger(),
            ]);
            const editableGroupIds = new Set(editableGroups.map((group) => group.id));
            return ledgerRows.filter((ledger) => editableGroupIds.has(ledger.ledgerGroupId));
          })
        : null,
    ]);

    // Fixed section order — Products, Customers, Suppliers, Ledgers — never
    // a single flat list re-sorted by a fabricated cross-entity relevance
    // score (Business Rules: "Grouped, not interleaved, results").
    const groups: GlobalSearchGroup[] = [];

    if (products) {
      groups.push(
        toGroup("products", "Products", products, (product) => ({
          id: product.id,
          title: product.name,
          subtitle: product.productCode ?? undefined,
          href: `/masters/products/${product.id}`,
        }))
      );
    }
    if (customers) {
      groups.push(
        toGroup("customers", "Customers", customers, (customer) => ({
          id: customer.id,
          title: customer.ledger.name,
          subtitle: customer.mobileNumber ?? undefined,
          href: `/masters/customers/${customer.id}/edit`,
        }))
      );
    }
    if (suppliers) {
      groups.push(
        toGroup("suppliers", "Suppliers", suppliers, (supplier) => ({
          id: supplier.id,
          title: supplier.ledger.name,
          subtitle: supplier.mobileNumber ?? undefined,
          href: `/masters/suppliers/${supplier.id}/edit`,
        }))
      );
    }
    if (ledgers) {
      groups.push(
        toGroup("ledgers", "Ledgers", ledgers, (ledger) => ({
          id: ledger.id,
          title: ledger.name,
          subtitle: ledger.ledgerGroup.name,
          href: `/accounting/ledgers/${ledger.id}/edit`,
        }))
      );
    }

    return groups;
  },
};
