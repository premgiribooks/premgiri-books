"use server";

import { customerService } from "@/modules/customers/services/customer-service";
import { productService } from "@/modules/products/services/product-service";
import { supplierService } from "@/modules/suppliers/services/supplier-service";

export interface SearchResultItem {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

export interface SearchResults {
  products: SearchResultItem[];
  customers: SearchResultItem[];
  suppliers: SearchResultItem[];
}

const EMPTY_RESULTS: SearchResults = { products: [], customers: [], suppliers: [] };
const MAX_RESULTS_PER_CATEGORY = 5;
const MIN_QUERY_LENGTH = 2;

async function safeSearch<T>(run: () => Promise<T[]>): Promise<T[]> {
  try {
    return await run();
  } catch {
    // AuthorizationError (no masters:view) or another transient failure —
    // omit this category instead of failing the whole search.
    return [];
  }
}

/**
 * The "DATA" tier of the Command Palette / global search (as opposed to the
 * "PAGES" tier, which is pure client-side nav-tree filtering — see
 * navigation-filter.ts). Reuses each module's own service — already
 * company-scoped and permission-checked via assertPermission — instead of
 * duplicating query logic (see product-service.ts/customer-service.ts/
 * supplier-service.ts). Kept to the three entities whose repositories
 * already support a `search` filter; extend this list only by reusing
 * another module's existing search-capable service the same way.
 */
export async function searchEntities(query: string): Promise<SearchResults> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return EMPTY_RESULTS;
  }

  const [products, customers, suppliers] = await Promise.all([
    safeSearch(() => productService.listProducts({ search: trimmed })),
    safeSearch(() => customerService.listCustomers({ search: trimmed })),
    safeSearch(() => supplierService.listSuppliers({ search: trimmed })),
  ]);

  return {
    products: products.slice(0, MAX_RESULTS_PER_CATEGORY).map((product) => ({
      id: product.id,
      label: product.name,
      sublabel: product.productCode ?? undefined,
      href: `/masters/products/${product.id}`,
    })),
    customers: customers.slice(0, MAX_RESULTS_PER_CATEGORY).map((customer) => ({
      id: customer.id,
      label: customer.ledger.name,
      sublabel: customer.mobileNumber ?? undefined,
      href: `/masters/customers/${customer.id}/edit`,
    })),
    suppliers: suppliers.slice(0, MAX_RESULTS_PER_CATEGORY).map((supplier) => ({
      id: supplier.id,
      label: supplier.ledger.name,
      sublabel: supplier.mobileNumber ?? undefined,
      href: `/masters/suppliers/${supplier.id}/edit`,
    })),
  };
}
