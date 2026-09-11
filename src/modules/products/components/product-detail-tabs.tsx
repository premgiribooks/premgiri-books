import Link from "next/link";

import { cn } from "@/lib/utils";

export type ProductDetailTabKey = "overview" | "batches";

export interface ProductDetailTab {
  key: ProductDetailTabKey;
  label: string;
  href: string;
}

/**
 * Pure tab-list builder (56-product-detail-page.md) — kept separate from the
 * component so the "Batches only appears when isBatchTracked" rule is
 * directly unit-testable without a DOM-rendering harness (this codebase has
 * none — see product-detail-tabs.test.ts). A future Serial Numbers tab
 * (spec 51's own isSerialTracked gate) is one more conditional push here,
 * not a restructure.
 */
export function getProductDetailTabs(productId: string, isBatchTracked: boolean): ProductDetailTab[] {
  const tabs: ProductDetailTab[] = [
    { key: "overview", label: "Overview", href: `/masters/products/${productId}` },
  ];
  if (isBatchTracked) {
    tabs.push({ key: "batches", label: "Batches", href: `/masters/products/${productId}/batches` });
  }
  return tabs;
}

interface ProductDetailTabsProps {
  productId: string;
  isBatchTracked: boolean;
  active: ProductDetailTabKey;
}

/**
 * Route-based tab shell — Overview and Batches are separate pages, not a
 * client-side tab switch, so this renders plain links highlighted by which
 * route is currently active rather than the stateful shadcn `Tabs`
 * primitive (which owns its own active-panel state, unsuited to
 * route-driven tabs).
 */
export function ProductDetailTabs({ productId, isBatchTracked, active }: ProductDetailTabsProps) {
  const tabs = getProductDetailTabs(productId, isBatchTracked);

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
