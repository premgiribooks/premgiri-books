"use client";

import * as React from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProductOptionItem } from "@/modules/products/components/product-option-selector";
import { StockAdjustmentLineRow } from "@/modules/stock-adjustments/components/stock-adjustment-line-row";
import type { CreateStockAdjustmentInput } from "@/modules/stock-adjustments/validation/stock-adjustment-schema";
import type { StockAdjustmentProductOption, StockAdjustmentWarehouseOption } from "@/types/stock-adjustment";

function blankLine() {
  return {
    productId: "" as unknown as string,
    warehouseId: "" as unknown as string,
    direction: "IN" as const,
    quantity: 1,
    narration: undefined,
  };
}

function productLabel(product: StockAdjustmentProductOption): string {
  const base = product.productCode ? `${product.name} (${product.productCode})` : product.name;
  return product.isActive ? base : `${base} (Inactive)`;
}

function warehouseLabel(warehouse: StockAdjustmentWarehouseOption): string {
  return `${warehouse.name} (${warehouse.code})`;
}

interface StockAdjustmentLineEditorProps {
  products: StockAdjustmentProductOption[];
  warehouses: StockAdjustmentWarehouseOption[];
}

/** Free add/remove multi-line grid — mirrors opening-stock-line-editor.tsx. */
export function StockAdjustmentLineEditor({ products, warehouses }: StockAdjustmentLineEditorProps) {
  const { control } = useFormContext<CreateStockAdjustmentInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const productOptions: ProductOptionItem[] = React.useMemo(
    () => products.map((product) => ({ id: product.id, label: productLabel(product), isActive: product.isActive })),
    [products]
  );
  const warehouseOptions: ProductOptionItem[] = React.useMemo(
    () => warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouseLabel(warehouse), isActive: warehouse.isActive })),
    [warehouses]
  );
  const productsById = React.useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Narration</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <StockAdjustmentLineRow
                key={field.id}
                index={index}
                productOptions={productOptions}
                warehouseOptions={warehouseOptions}
                productsById={productsById}
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
