import type { ReactNode } from "react";

import { ProductStatusBadge } from "@/modules/products/components/product-status-badge";
import { ProductTypeBadge } from "@/modules/products/components/product-type-badge";
import type { ProductWithRelations } from "@/types/product";

interface ProductOverviewPanelProps {
  product: ProductWithRelations;
}

interface DetailFieldProps {
  label: string;
  children: ReactNode;
  numeric?: boolean;
}

function DetailField({ label, children, numeric = false }: DetailFieldProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={numeric ? "font-financial text-sm text-foreground" : "text-sm text-foreground"}>
        {children}
      </p>
    </div>
  );
}

function optionName(option: { name: string } | null): ReactNode {
  return option ? option.name : <span className="text-muted-foreground">—</span>;
}

function money(value: number | null): ReactNode {
  return value === null ? <span className="text-muted-foreground">—</span> : value.toFixed(2);
}

/**
 * Overview tab content (56-product-detail-page.md) — read-only display of
 * every Product field plus its resolved related master names, grouped the
 * same way ProductForm's sections are (Identity, Classification, Tax,
 * Pricing, Stock). No calculation happens here — every value is either a
 * stored field or a name already resolved by productService.getProduct.
 */
export function ProductOverviewPanel({ product }: ProductOverviewPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Identity</h2>
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <DetailField label="Name">{product.name}</DetailField>
          <DetailField label="Product Code" numeric>
            {product.productCode}
          </DetailField>
          <DetailField label="Barcode" numeric>
            {product.barcode ?? <span className="text-muted-foreground">—</span>}
          </DetailField>
          <DetailField label="Product Type">
            <ProductTypeBadge productType={product.productType} />
          </DetailField>
          <DetailField label="Status">
            <ProductStatusBadge isActive={product.isActive} />
          </DetailField>
          <DetailField label="Description">
            {product.description ?? <span className="text-muted-foreground">—</span>}
          </DetailField>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Classification</h2>
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <DetailField label="Category">{optionName(product.category)}</DetailField>
          <DetailField label="Brand">{optionName(product.brand)}</DetailField>
          <DetailField label="Unit">
            {product.unit.name} ({product.unit.symbol})
          </DetailField>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Tax</h2>
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <DetailField label={product.hsnCode?.codeType === "SAC" ? "SAC Code" : "HSN Code"}>
            {product.hsnCode ? `${product.hsnCode.code} — ${product.hsnCode.description}` : <span className="text-muted-foreground">—</span>}
          </DetailField>
          <DetailField label="GST Rate">{optionName(product.gstRate)}</DetailField>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Pricing</h2>
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-4">
          <DetailField label="MRP" numeric>
            {money(product.mrp)}
          </DetailField>
          <DetailField label="Selling Price" numeric>
            {money(product.sellingPrice)}
          </DetailField>
          <DetailField label="Purchase Price" numeric>
            {money(product.purchasePrice)}
          </DetailField>
          <DetailField label="Margin Profile">{optionName(product.marginProfile)}</DetailField>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Stock</h2>
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <DetailField label="Min Stock Level" numeric>
            {product.minStockLevel === null ? <span className="text-muted-foreground">—</span> : product.minStockLevel}
          </DetailField>
          <DetailField label="Default Warehouse">{optionName(product.defaultWarehouse)}</DetailField>
          <DetailField label="Batch Tracking">{product.isBatchTracked ? "Enabled" : "Disabled"}</DetailField>
          <DetailField label="Serial Number Tracking">{product.isSerialTracked ? "Enabled" : "Disabled"}</DetailField>
        </div>
      </section>
    </div>
  );
}
