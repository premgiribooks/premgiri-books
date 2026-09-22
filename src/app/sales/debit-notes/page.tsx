import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreDebitNotesAction } from "@/modules/debit-notes/actions/debit-note-actions";
import { DebitNoteFilterBar } from "@/modules/debit-notes/components/debit-note-filter-bar";
import { DebitNoteTable } from "@/modules/debit-notes/components/debit-note-table";
import { debitNoteService } from "@/modules/debit-notes/services/debit-note-service";
import { DEBIT_NOTE_STATUS_VALUES } from "@/modules/debit-notes/validation/debit-note-schema";
import { customerService } from "@/modules/customers/services/customer-service";
import type { DebitNoteListFilters, DebitNoteStatusFilter } from "@/types/debit-note";

interface DebitNoteListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): DebitNoteListFilters {
  const filters: DebitNoteListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (DEBIT_NOTE_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as DebitNoteStatusFilter;
  }

  const customerId = firstValue(params.customerId);
  if (customerId) {
    filters.customerId = customerId;
  }

  return filters;
}

export default async function DebitNoteListPage({ searchParams }: DebitNoteListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [{ items: debitNotes, hasMore }, customers, isAdmin, canCreate] = await Promise.all([
    debitNoteService.listDebitNotesPage(filters, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    customerService.listSelectableCustomers(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Debit Notes</h1>
            <p className="text-sm text-muted-foreground">
              Pure financial adjustments increasing what a customer owes — no stock movement.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/sales/debit-notes/new">
                  <Plus size={18} />
                  New Debit Note
                </Link>
              }
            />
          ) : null}
        </div>

        <DebitNoteFilterBar customers={customers.map((customer) => ({ id: customer.id, name: customer.ledger.name }))} />

        <DebitNoteTable
          key={JSON.stringify(filters)}
          debitNotes={debitNotes}
          initialHasMore={hasMore}
          loadMore={loadMoreDebitNotesAction.bind(null, filters)}
        />
      </div>
    </AppShell>
  );
}
