import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseInvoiceFilterBar } from "@/modules/purchase-invoices/components/purchase-invoice-filter-bar";
import { PurchaseInvoiceTable } from "@/modules/purchase-invoices/components/purchase-invoice-table";
import { purchaseInvoiceService } from "@/modules/purchase-invoices/services/purchase-invoice-service";
import { PURCHASE_INVOICE_STATUS_VALUES } from "@/modules/purchase-invoices/validation/purchase-invoice-schema";
import { supplierService } from "@/modules/suppliers/services/supplier-service";
import type { PurchaseInvoiceListFilters, PurchaseInvoiceStatusFilter } from "@/types/purchase-invoice";

interface PurchaseInvoiceListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): PurchaseInvoiceListFilters {
  const filters: PurchaseInvoiceListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (PURCHASE_INVOICE_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as PurchaseInvoiceStatusFilter;
  }

  const supplierId = firstValue(params.supplierId);
  if (supplierId) {
    filters.supplierId = supplierId;
  }

  return filters;
}

export default async function PurchaseInvoiceListPage({ searchParams }: PurchaseInvoiceListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "purchase", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [purchaseInvoices, suppliers, isAdmin, canCreate] = await Promise.all([
    purchaseInvoiceService.listPurchaseInvoices(filters),
    supplierService.listSelectableSuppliers(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "purchase", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Purchase Invoices</h1>
            <p className="text-sm text-muted-foreground">
              The document that records a supplier&apos;s bill — posting moves stock and creates accounting entries.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/purchase/invoices/new">
                  <Plus size={18} />
                  New Purchase Invoice
                </Link>
              }
            />
          ) : null}
        </div>

        <PurchaseInvoiceFilterBar
          suppliers={suppliers.map((supplier) => ({
            id: supplier.id,
            name: supplier.ledger.name,
            isActive: supplier.isActive,
            creditDays: supplier.creditDays,
            ledgerId: supplier.ledgerId,
          }))}
        />

        <PurchaseInvoiceTable purchaseInvoices={purchaseInvoices} />
      </div>
    </AppShell>
  );
}
