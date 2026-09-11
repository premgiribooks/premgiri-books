import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { BreadcrumbLabelSetter } from "@/components/layout/breadcrumb-label-setter";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ProductDetailTabs } from "@/modules/products/components/product-detail-tabs";
import { ProductOverviewPanel } from "@/modules/products/components/product-overview-panel";
import { ProductStatusBadge } from "@/modules/products/components/product-status-badge";
import { ProductTypeBadge } from "@/modules/products/components/product-type-badge";
import { productService } from "@/modules/products/services/product-service";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Overview tab of the Product detail view (56-product-detail-page.md) — the
 * permanent home for every per-product surface this codebase has (Batches,
 * here) or will add (Serial Numbers, spec 51). Read-only composition over
 * productService.getProduct; no writes happen on this page.
 */
export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
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

  const [isAdmin, canEdit] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "masters", "edit"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <BreadcrumbLabelSetter href={`/masters/products/${product.id}`} label={product.name} />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{product.name}</h1>
              <ProductTypeBadge productType={product.productType} />
              <ProductStatusBadge isActive={product.isActive} />
            </div>
            <p className="text-sm text-muted-foreground">{product.productCode}</p>
          </div>

          {canEdit ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link href={`/masters/products/${product.id}/edit`}>
                  <Pencil size={16} />
                  Edit
                </Link>
              }
            />
          ) : null}
        </div>

        <ProductDetailTabs
          productId={product.id}
          isBatchTracked={product.isBatchTracked}
          isSerialTracked={product.isSerialTracked}
          active="overview"
        />

        <ProductOverviewPanel product={product} />
      </div>
    </AppShell>
  );
}
