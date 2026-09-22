import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMorePurchaseCreditNotesAction } from "@/modules/purchase-credit-notes/actions/purchase-credit-note-actions";
import { PurchaseCreditNoteFilterBar } from "@/modules/purchase-credit-notes/components/purchase-credit-note-filter-bar";
import { PurchaseCreditNoteTable } from "@/modules/purchase-credit-notes/components/purchase-credit-note-table";
import { purchaseCreditNoteService } from "@/modules/purchase-credit-notes/services/purchase-credit-note-service";
import { PURCHASE_CREDIT_NOTE_STATUS_VALUES } from "@/modules/purchase-credit-notes/validation/purchase-credit-note-schema";
import { supplierService } from "@/modules/suppliers/services/supplier-service";
import type { PurchaseCreditNoteListFilters, PurchaseCreditNoteStatusFilter } from "@/types/purchase-credit-note";

interface PurchaseCreditNoteListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): PurchaseCreditNoteListFilters {
  const filters: PurchaseCreditNoteListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (PURCHASE_CREDIT_NOTE_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as PurchaseCreditNoteStatusFilter;
  }

  const supplierId = firstValue(params.supplierId);
  if (supplierId) {
    filters.supplierId = supplierId;
  }

  return filters;
}

export default async function PurchaseCreditNoteListPage({ searchParams }: PurchaseCreditNoteListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "purchase", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [{ items: purchaseCreditNotes, hasMore }, suppliers, isAdmin, canCreate] = await Promise.all([
    purchaseCreditNoteService.listPurchaseCreditNotesPage(filters, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    supplierService.listSelectableSuppliers(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "purchase", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Credit Notes</h1>
            <p className="text-sm text-muted-foreground">
              Pure financial adjustments reducing what the company owes a supplier — no stock movement.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/purchase/credit-notes/new">
                  <Plus size={18} />
                  New Credit Note
                </Link>
              }
            />
          ) : null}
        </div>

        <PurchaseCreditNoteFilterBar suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.ledger.name }))} />

        <PurchaseCreditNoteTable
          key={JSON.stringify(filters)}
          purchaseCreditNotes={purchaseCreditNotes}
          initialHasMore={hasMore}
          loadMore={loadMorePurchaseCreditNotesAction.bind(null, filters)}
        />
      </div>
    </AppShell>
  );
}
