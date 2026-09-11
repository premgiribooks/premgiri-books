"use client";

import * as React from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProductOptionItem } from "@/modules/products/components/product-option-selector";
import { StockTransferLineRow } from "@/modules/stock-transfers/components/stock-transfer-line-row";
import type { CreateStockTransferInput } from "@/modules/stock-transfers/validation/stock-transfer-schema";
import type { StockTransferProductOption } from "@/types/stock-transfer";

function blankLine() {
  return { productId: "" as unknown as string, quantity: 1 };
}

function productLabel(product: StockTransferProductOption): string {
  const base = `${product.name} (${product.productCode})`;
  return product.isActive ? base : `${base} (Inactive)`;
}

interface StockTransferLineEditorProps {
  products: StockTransferProductOption[];
}

/** Free add/remove multi-line grid — mirrors stock-adjustment-line-editor.tsx,
 * minus the per-line warehouse/direction columns (source/destination are
 * header-level here). */
export function StockTransferLineEditor({ products }: StockTransferLineEditorProps) {
  const { control } = useFormContext<CreateStockTransferInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const productOptions: ProductOptionItem[] = React.useMemo(
    () => products.map((product) => ({ id: product.id, label: productLabel(product), isActive: product.isActive })),
    [products]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <StockTransferLineRow
                key={field.id}
                index={index}
                productOptions={productOptions}
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
