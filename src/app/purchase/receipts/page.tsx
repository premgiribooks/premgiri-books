import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreGoodsReceiptNotesAction } from "@/modules/goods-receipt-notes/actions/goods-receipt-note-actions";
import { GoodsReceiptNoteFilterBar } from "@/modules/goods-receipt-notes/components/goods-receipt-note-filter-bar";
import { GoodsReceiptNoteTable } from "@/modules/goods-receipt-notes/components/goods-receipt-note-table";
import { goodsReceiptNoteService } from "@/modules/goods-receipt-notes/services/goods-receipt-note-service";
import { GOODS_RECEIPT_NOTE_STATUS_VALUES } from "@/modules/goods-receipt-notes/validation/goods-receipt-note-schema";
import { supplierService } from "@/modules/suppliers/services/supplier-service";
import type { GoodsReceiptNoteListFilters, GoodsReceiptNoteStatusFilter } from "@/types/goods-receipt-note";

interface GoodsReceiptNoteListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Filter state lives in the URL (see goods-receipt-note-filter-bar.tsx);
// unknown values are ignored rather than erroring — mirrors the delivery
// challan list page's identical convention.
function parseFilters(params: Record<string, string | string[] | undefined>): GoodsReceiptNoteListFilters {
  const filters: GoodsReceiptNoteListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (GOODS_RECEIPT_NOTE_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as GoodsReceiptNoteStatusFilter;
  }

  const supplierId = firstValue(params.supplierId);
  if (supplierId) {
    filters.supplierId = supplierId;
  }

  return filters;
}

export default async function GoodsReceiptNoteListPage({ searchParams }: GoodsReceiptNoteListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "purchase", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [{ items: goodsReceiptNotes, hasMore }, suppliers, isAdmin, canCreate] = await Promise.all([
    goodsReceiptNoteService.listGoodsReceiptNotesPage(filters, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    supplierService.listSelectableSuppliers(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "purchase", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Goods Receipt Notes</h1>
            <p className="text-sm text-muted-foreground">
              The receiving record between a confirmed Purchase Order and the eventual Purchase
              Invoice.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/purchase/receipts/new">
                  <Plus size={18} />
                  New Goods Receipt Note
                </Link>
              }
            />
          ) : null}
        </div>

        <GoodsReceiptNoteFilterBar
          suppliers={suppliers.map((supplier) => ({
            id: supplier.id,
            name: supplier.ledger.name,
            isActive: supplier.isActive,
          }))}
        />

        <GoodsReceiptNoteTable
          key={JSON.stringify(filters)}
          goodsReceiptNotes={goodsReceiptNotes}
          initialHasMore={hasMore}
          loadMore={loadMoreGoodsReceiptNotesAction.bind(null, filters)}
        />
      </div>
    </AppShell>
  );
}
