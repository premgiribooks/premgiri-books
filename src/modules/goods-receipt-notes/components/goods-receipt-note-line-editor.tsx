"use client";

import * as React from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductOptionItem } from "@/modules/products/components/product-option-selector";
import { GoodsReceiptNoteLineRow } from "@/modules/goods-receipt-notes/components/goods-receipt-note-line-row";
import type { CreateGoodsReceiptNoteInput } from "@/modules/goods-receipt-notes/validation/goods-receipt-note-schema";
import type {
  GoodsReceiptNoteProductOption,
  GoodsReceiptNoteWarehouseOption,
  OpenPurchaseOrderLineOption,
} from "@/types/goods-receipt-note";

const BLANK_LINE = {
  productId: "" as unknown as string,
  warehouseId: "" as unknown as string,
  quantity: 1,
  rejectedQuantity: 0,
};

function optionLabel(product: GoodsReceiptNoteProductOption): string {
  const base = product.productCode ? `${product.name} (${product.productCode})` : product.name;
  return product.isActive ? base : `${base} (Inactive)`;
}

function warehouseLabel(warehouse: GoodsReceiptNoteWarehouseOption): string {
  return `${warehouse.name} (${warehouse.code})`;
}

interface GoodsReceiptNoteLineEditorProps {
  products: GoodsReceiptNoteProductOption[];
  warehouses: GoodsReceiptNoteWarehouseOption[];
  /** When set, every row is locked to one of the linked Purchase Order's
   * remaining lines — product fixed, no Add Line button (a GRN linked to an
   * order can only receive against that order's own lines, per
   * 43-goods-receipt-note.md's Data Model). */
  linkedLines?: OpenPurchaseOrderLineOption[];
}

/** The Goods Receipt Note Form's line-item editor — no pricing/tax columns,
 * unlike purchase-order-line-editor.tsx (this document records quantity,
 * rejected quantity, and receiving warehouse only). */
export function GoodsReceiptNoteLineEditor({ products, warehouses, linkedLines }: GoodsReceiptNoteLineEditorProps) {
  const { control } = useFormContext<CreateGoodsReceiptNoteInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const productOptions: ProductOptionItem[] = React.useMemo(
    () => products.map((product) => ({ id: product.id, label: optionLabel(product), isActive: product.isActive })),
    [products]
  );

  const warehouseOptions: ProductOptionItem[] = React.useMemo(
    () => warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouseLabel(warehouse), isActive: warehouse.isActive })),
    [warehouses]
  );

  const linkedLineByIndex = linkedLines;
  const isLinked = linkedLineByIndex !== undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Received Qty</TableHead>
              <TableHead>Rejected Qty</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <GoodsReceiptNoteLineRow
                key={field.id}
                index={index}
                productOptions={productOptions}
                warehouseOptions={warehouseOptions}
                linkedLine={linkedLineByIndex?.[index]}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {!isLinked ? (
        <Button type="button" variant="outline" size="sm" onClick={() => append(BLANK_LINE)}>
          <Plus size={16} />
          Add Line
        </Button>
      ) : null}
    </div>
  );
}
