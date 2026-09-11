"use client";

import * as React from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getWarehouseStockPreviewAction } from "@/modules/physical-verifications/actions/physical-verification-actions";
import { PhysicalVerificationLineRow } from "@/modules/physical-verifications/components/physical-verification-line-row";
import type { CreatePhysicalVerificationInput } from "@/modules/physical-verifications/validation/physical-verification-schema";
import type { ProductOptionItem } from "@/modules/products/components/product-option-selector";
import type { PhysicalVerificationProductOption } from "@/types/physical-verification";

function blankLine() {
  return { productId: "" as unknown as string, countedQuantity: 0 };
}

function productLabel(product: PhysicalVerificationProductOption): string {
  const base = `${product.name} (${product.productCode})`;
  return product.isActive ? base : `${base} (Inactive)`;
}

interface PhysicalVerificationLineEditorProps {
  products: PhysicalVerificationProductOption[];
}

/** Free add/remove multi-line grid with a live system-quantity preview
 * column (49-physical-verification.md's UI) — mirrors
 * stock-transfer-line-editor.tsx's shape, extended with a fetch-on-
 * warehouse-change stock preview map handed down to every row. */
export function PhysicalVerificationLineEditor({ products }: PhysicalVerificationLineEditorProps) {
  const { control } = useFormContext<CreatePhysicalVerificationInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const warehouseId = useWatch({ control, name: "warehouseId" });

  const [stockPreview, setStockPreview] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (!warehouseId) {
      return;
    }
    let cancelled = false;
    getWarehouseStockPreviewAction(warehouseId).then((result) => {
      if (!cancelled && result.success && result.data) {
        setStockPreview(result.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  // Stale preview from a previously-selected warehouse must not display once
  // the warehouse field is cleared — derived here rather than reset via a
  // synchronous setState in the effect above (react-hooks/set-state-in-effect).
  const effectiveStockPreview = warehouseId ? stockPreview : {};

  const productOptions: ProductOptionItem[] = React.useMemo(
    () => products.map((product) => ({ id: product.id, label: productLabel(product), isActive: product.isActive })),
    [products]
  );
  const unitDecimalPlacesByProduct = React.useMemo(
    () => new Map(products.map((product) => [product.id, product.unitDecimalPlaces])),
    [products]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">System Qty</TableHead>
              <TableHead>Counted Qty</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <PhysicalVerificationLineRow
                key={field.id}
                index={index}
                productOptions={productOptions}
                unitDecimalPlacesByProduct={unitDecimalPlacesByProduct}
                stockPreview={effectiveStockPreview}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={() => append(blankLine())}>
        <Plus size={16} />
        Add Line
      </Button>
    </div>
  );
}
