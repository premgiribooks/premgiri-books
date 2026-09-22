import { ProductPurchasePriceHistoryTable } from "@/modules/product-purchase-price-history/components/product-purchase-price-history-table";
import type { ProductPurchasePriceHistoryRow } from "@/types/product-purchase-price-history";

interface ProductPurchasePriceHistoryPanelProps {
  rows: ProductPurchasePriceHistoryRow[];
}

/**
 * Purchase Price History tab content (95-purchase-price-sync.md) — lives
 * under `products/`, not `product-purchase-price-history/`, mirroring
 * product-batches-panel.tsx's own placement: the panel that composes a tab
 * belongs to the host page's module, the table primitive belongs to the
 * satellite module. No dialog/create state here (unlike the Batches panel)
 * — history rows are system-generated only, nothing to create or edit.
 */
export function ProductPurchasePriceHistoryPanel({ rows }: ProductPurchasePriceHistoryPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <ProductPurchasePriceHistoryTable rows={rows} />
    </div>
  );
}
