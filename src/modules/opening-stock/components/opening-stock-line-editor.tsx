"use client";

import * as React from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProductOptionItem } from "@/modules/products/components/product-option-selector";
import { OpeningStockLineRow } from "@/modules/opening-stock/components/opening-stock-line-row";
import type { RecordOpeningStockInput } from "@/modules/opening-stock/validation/opening-stock-schema";
import type { OpeningStockProductOption, OpeningStockWarehouseOption } from "@/types/opening-stock";

function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function blankLine() {
  return {
    productId: "" as unknown as string,
    warehouseId: "" as unknown as string,
    quantity: 1,
    unitCost: undefined,
    transactionDate: todayDateInputValue(),
    narration: undefined,
  };
}

function productLabel(product: OpeningStockProductOption): string {
  const base = product.productCode ? `${product.name} (${product.productCode})` : product.name;
  return product.isActive ? base : `${base} (Inactive)`;
}

function warehouseLabel(warehouse: OpeningStockWarehouseOption): string {
  return `${warehouse.name} (${warehouse.code})`;
}

interface OpeningStockLineEditorProps {
  products: OpeningStockProductOption[];
  warehouses: OpeningStockWarehouseOption[];
}

/** Free add/remove multi-line grid — mirrors purchase-invoice-line-editor.tsx,
 * minus the live tax/total computation this document never needs. */
export function OpeningStockLineEditor({ products, warehouses }: OpeningStockLineEditorProps) {
  const { control } = useFormContext<RecordOpeningStockInput>();
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
              <TableHead>Qty</TableHead>
              <TableHead>Unit Cost</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Narration</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <OpeningStockLineRow
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
