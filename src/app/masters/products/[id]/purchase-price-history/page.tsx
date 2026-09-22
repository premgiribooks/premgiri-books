import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { BreadcrumbLabelSetter } from "@/components/layout/breadcrumb-label-setter";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { productPurchasePriceHistoryService } from "@/modules/product-purchase-price-history/services/product-purchase-price-history-service";
import { ProductPurchasePriceHistoryPanel } from "@/modules/products/components/product-purchase-price-history-panel";
import { ProductDetailTabs } from "@/modules/products/components/product-detail-tabs";
import { productService } from "@/modules/products/services/product-service";

interface ProductPurchasePriceHistoryPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Purchase Price History tab of the Product detail view
 * (95-purchase-price-sync.md) — unlike Batches/Serial Numbers, this tab
 * applies unconditionally to every product (no isBatchTracked-style
 * redirect), since every product has a purchasePrice cost basis.
 */
export default async function ProductPurchasePriceHistoryPage({ params }: ProductPurchasePriceHistoryPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/masters/products");
  }

  const product = await productService.getProduct(id);
  if (!product) {
    notFound();
  }

  const [isAdmin, rows] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    productPurchasePriceHistoryService.listHistoryForProduct(product.id),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <BreadcrumbLabelSetter href={`/masters/products/${product.id}`} label={product.name} />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{product.name}</h1>
          <p className="text-sm text-muted-foreground">{product.productCode ?? "—"}</p>
        </div>

        <ProductDetailTabs
          productId={product.id}
          isBatchTracked={product.isBatchTracked}
          isSerialTracked={product.isSerialTracked}
          active="purchase-price-history"
        />

        <ProductPurchasePriceHistoryPanel rows={rows} />
      </div>
    </AppShell>
  );
}
