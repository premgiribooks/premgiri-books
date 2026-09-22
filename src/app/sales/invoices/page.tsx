import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { customerService } from "@/modules/customers/services/customer-service";
import { loadMoreSalesInvoicesAction } from "@/modules/sales-invoices/actions/sales-invoice-actions";
import { SalesInvoiceFilterBar } from "@/modules/sales-invoices/components/sales-invoice-filter-bar";
import { SalesInvoiceTable } from "@/modules/sales-invoices/components/sales-invoice-table";
import { salesInvoiceService } from "@/modules/sales-invoices/services/sales-invoice-service";
import { SALES_INVOICE_STATUS_VALUES } from "@/modules/sales-invoices/validation/sales-invoice-schema";
import type { SalesInvoiceListFilters, SalesInvoiceStatusFilter } from "@/types/sales-invoice";

interface SalesInvoiceListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): SalesInvoiceListFilters {
  const filters: SalesInvoiceListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (SALES_INVOICE_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as SalesInvoiceStatusFilter;
  }

  const customerId = firstValue(params.customerId);
  if (customerId) {
    filters.customerId = customerId;
  }

  return filters;
}

export default async function SalesInvoiceListPage({ searchParams }: SalesInvoiceListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [{ items: salesInvoices, hasMore }, customers, isAdmin, canCreate] = await Promise.all([
    salesInvoiceService.listSalesInvoicesPage(filters, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    customerService.listSelectableCustomers(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Sales Invoices</h1>
            <p className="text-sm text-muted-foreground">
              GST-compliant tax invoices that post accounting entries and stock movement.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/sales/invoices/new">
                  <Plus size={18} />
                  New Sales Invoice
                </Link>
              }
            />
          ) : null}
        </div>

        <SalesInvoiceFilterBar
          customers={customers.map((customer) => ({
            id: customer.id,
            name: customer.ledger.name,
            isActive: customer.isActive,
            creditLimit: customer.creditLimit,
            ledgerId: customer.ledgerId,
            gstin: customer.gstin,
            addressLine1: customer.addressLine1,
            addressLine2: customer.addressLine2,
            city: customer.city,
            state: customer.state,
            pinCode: customer.pinCode,
          }))}
        />

        <SalesInvoiceTable
          key={JSON.stringify(filters)}
          salesInvoices={salesInvoices}
          initialHasMore={hasMore}
          loadMore={loadMoreSalesInvoicesAction.bind(null, filters)}
        />
      </div>
    </AppShell>
  );
}
