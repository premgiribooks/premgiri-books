import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreCreditNotesAction } from "@/modules/credit-notes/actions/credit-note-actions";
import { CreditNoteFilterBar } from "@/modules/credit-notes/components/credit-note-filter-bar";
import { CreditNoteTable } from "@/modules/credit-notes/components/credit-note-table";
import { creditNoteService } from "@/modules/credit-notes/services/credit-note-service";
import { CREDIT_NOTE_STATUS_VALUES } from "@/modules/credit-notes/validation/credit-note-schema";
import { customerService } from "@/modules/customers/services/customer-service";
import type { CreditNoteListFilters, CreditNoteStatusFilter } from "@/types/credit-note";

interface CreditNoteListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): CreditNoteListFilters {
  const filters: CreditNoteListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (CREDIT_NOTE_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as CreditNoteStatusFilter;
  }

  const customerId = firstValue(params.customerId);
  if (customerId) {
    filters.customerId = customerId;
  }

  return filters;
}

export default async function CreditNoteListPage({ searchParams }: CreditNoteListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [{ items: creditNotes, hasMore }, customers, isAdmin, canCreate] = await Promise.all([
    creditNoteService.listCreditNotesPage(filters, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    customerService.listSelectableCustomers(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Credit Notes</h1>
            <p className="text-sm text-muted-foreground">
              Pure financial adjustments reducing what a customer owes — no stock movement.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/sales/credit-notes/new">
                  <Plus size={18} />
                  New Credit Note
                </Link>
              }
            />
          ) : null}
        </div>

        <CreditNoteFilterBar customers={customers.map((customer) => ({ id: customer.id, name: customer.ledger.name }))} />

        <CreditNoteTable
          key={JSON.stringify(filters)}
          creditNotes={creditNotes}
          initialHasMore={hasMore}
          loadMore={loadMoreCreditNotesAction.bind(null, filters)}
        />
      </div>
    </AppShell>
  );
}
