import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { customerService } from "@/modules/customers/services/customer-service";
import { QuotationFilterBar } from "@/modules/quotations/components/quotation-filter-bar";
import { QuotationTable } from "@/modules/quotations/components/quotation-table";
import { quotationService } from "@/modules/quotations/services/quotation-service";
import { QUOTATION_STATUS_VALUES } from "@/modules/quotations/validation/quotation-schema";
import type { QuotationListFilters, QuotationStatusFilter } from "@/types/quotation";

interface QuotationListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Filter state lives in the URL (see quotation-filter-bar.tsx); unknown
// values are ignored rather than erroring — a hand-edited query string just
// falls back to the unfiltered list, the customer-list-page convention.
function parseFilters(params: Record<string, string | string[] | undefined>): QuotationListFilters {
  const filters: QuotationListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (QUOTATION_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as QuotationStatusFilter;
  }

  const customerId = firstValue(params.customerId);
  if (customerId) {
    filters.customerId = customerId;
  }

  return filters;
}

export default async function QuotationListPage({ searchParams }: QuotationListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [quotations, customers, isAdmin, canCreate] = await Promise.all([
    quotationService.listQuotations(filters),
    customerService.listSelectableCustomers(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Quotations</h1>
            <p className="text-sm text-muted-foreground">
              Priced offers to customers — the first, non-binding step of the Sales chain.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/sales/quotations/new">
                  <Plus size={18} />
                  New Quotation
                </Link>
              }
            />
          ) : null}
        </div>

        <QuotationFilterBar
          customers={customers.map((customer) => ({
            id: customer.id,
            name: customer.ledger.name,
            isActive: customer.isActive,
          }))}
        />

        <QuotationTable quotations={quotations} />
      </div>
    </AppShell>
  );
}
