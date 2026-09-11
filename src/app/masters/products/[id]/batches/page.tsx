import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { BreadcrumbLabelSetter } from "@/components/layout/breadcrumb-label-setter";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ProductBatchesPanel } from "@/modules/products/components/product-batches-panel";
import { ProductDetailTabs } from "@/modules/products/components/product-detail-tabs";
import { productService } from "@/modules/products/services/product-service";
import { productBatchService } from "@/modules/product-batches/services/product-batch-service";

interface ProductBatchesPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Batches tab of the Product detail view (56-product-detail-page.md) —
 * wires in Batch Tracking's (spec 50) unmodified `ProductBatchTable`/
 * `ProductBatchForm` for a batch-tracked product. Visiting this route for a
 * non-batch-tracked product redirects to Overview, matching the spec's
 * Business Rules.
 */
export default async function ProductBatchesPage({ params }: ProductBatchesPageProps) {
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

  if (!product.isBatchTracked) {
    redirect(`/masters/products/${product.id}`);
  }

  const [isAdmin, canCreate, canEdit, batches] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "masters", "create"),
    hasPermission(user, "masters", "edit"),
    productBatchService.listBatches(product.id),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <BreadcrumbLabelSetter href={`/masters/products/${product.id}`} label={product.name} />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{product.name}</h1>
          <p className="text-sm text-muted-foreground">{product.productCode}</p>
        </div>

        <ProductDetailTabs productId={product.id} isBatchTracked={product.isBatchTracked} active="batches" />

        <ProductBatchesPanel productId={product.id} batches={batches} canCreate={canCreate} canEdit={canEdit} />
      </div>
    </AppShell>
  );
}
