import Link from "next/link";

import { cn } from "@/lib/utils";

export type ProductDetailTabKey = "overview" | "batches" | "serial-numbers" | "purchase-price-history";

export interface ProductDetailTab {
  key: ProductDetailTabKey;
  label: string;
  href: string;
}

/**
 * Pure tab-list builder (56-product-detail-page.md) — kept separate from the
 * component so the "Batches only appears when isBatchTracked" rule (and now
 * the identical "Serial Numbers only appears when isSerialTracked" rule,
 * 51-serial-number-tracking.md) is directly unit-testable without a
 * DOM-rendering harness (this codebase has none — see
 * product-detail-tabs.test.ts). isBatchTracked/isSerialTracked are mutually
 * exclusive (enforced server-side), so at most one of the two extra tabs
 * ever appears alongside Overview.
 */
export function getProductDetailTabs(
  productId: string,
  isBatchTracked: boolean,
  isSerialTracked: boolean
): ProductDetailTab[] {
  const tabs: ProductDetailTab[] = [
    { key: "overview", label: "Overview", href: `/masters/products/${productId}` },
  ];
  if (isBatchTracked) {
    tabs.push({ key: "batches", label: "Batches", href: `/masters/products/${productId}/batches` });
  }
  if (isSerialTracked) {
    tabs.push({
      key: "serial-numbers",
      label: "Serial Numbers",
      href: `/masters/products/${productId}/serial-numbers`,
    });
  }
  // Unconditional (95-purchase-price-sync.md) — unlike Batches/Serial
  // Numbers, every product has a purchasePrice and can accumulate history,
  // regardless of tracking mode.
  tabs.push({
    key: "purchase-price-history",
    label: "Purchase Price History",
    href: `/masters/products/${productId}/purchase-price-history`,
  });
  return tabs;
}

interface ProductDetailTabsProps {
  productId: string;
  isBatchTracked: boolean;
  isSerialTracked: boolean;
  active: ProductDetailTabKey;
}

/**
 * Route-based tab shell — Overview, Batches, and Serial Numbers are separate
 * pages, not a client-side tab switch, so this renders plain links
 * highlighted by which route is currently active rather than the stateful
 * shadcn `Tabs` primitive (which owns its own active-panel state, unsuited
 * to route-driven tabs).
 */
export function ProductDetailTabs({ productId, isBatchTracked, isSerialTracked, active }: ProductDetailTabsProps) {
  const tabs = getProductDetailTabs(productId, isBatchTracked, isSerialTracked);

  return (
    <nav aria-label="Product detail tabs" className="flex items-center gap-1 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            active === tab.key
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
