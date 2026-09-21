import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { BreadcrumbLabelSetter } from "@/components/layout/breadcrumb-label-setter";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ProductDetailTabs } from "@/modules/products/components/product-detail-tabs";
import { ProductSerialNumbersPanel } from "@/modules/products/components/product-serial-numbers-panel";
import { productService } from "@/modules/products/services/product-service";
import { serialNumberService } from "@/modules/serial-numbers/services/serial-number-service";

interface ProductSerialNumbersPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Serial Numbers tab of the Product detail view (51-serial-number-
 * tracking.md, landing on the Product detail page feature-spec 56 built) —
 * mirrors the Batches tab page exactly. Visiting this route for a
 * non-serial-tracked product redirects to Overview, matching the spec's
 * Business Rules.
 */
export default async function ProductSerialNumbersPage({ params }: ProductSerialNumbersPageProps) {
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

  if (!product.isSerialTracked) {
    redirect(`/masters/products/${product.id}`);
  }

  const [isAdmin, canCreate, canEdit, serialNumbers] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "masters", "create"),
    hasPermission(user, "masters", "edit"),
    serialNumberService.listSerialNumbers(product.id),
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
          active="serial-numbers"
        />

        <ProductSerialNumbersPanel
          productId={product.id}
          serialNumbers={serialNumbers}
          canCreate={canCreate}
          canEdit={canEdit}
        />
      </div>
    </AppShell>
  );
}
