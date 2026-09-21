"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { TableCell, TableRow } from "@/components/ui/table";
import { numericFieldWidth } from "@/lib/utils";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import type { CreateGoodsReceiptNoteInput } from "@/modules/goods-receipt-notes/validation/goods-receipt-note-schema";
import type { OpenPurchaseOrderLineOption } from "@/types/goods-receipt-note";

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

interface GoodsReceiptNoteLineRowProps {
  index: number;
  productOptions: ProductOptionItem[];
  warehouseOptions: ProductOptionItem[];
  /** Set when this row is locked to a linked Purchase Order's line — the
   * product is fixed (shown as a label, no picker) and quantity + rejected
   * quantity together are capped at the order line's remaining quantity. */
  linkedLine?: OpenPurchaseOrderLineOption;
  onRemove: () => void;
  canRemove: boolean;
}

/** One line of the Goods Receipt Note Form's editor — no pricing/tax columns
 * (43-goods-receipt-note.md's Data Model: "quantity, rejected quantity, and
 * receiving warehouse only"), unlike purchase-order-line-row.tsx. */
export function GoodsReceiptNoteLineRow({
  index,
  productOptions,
  warehouseOptions,
  linkedLine,
  onRemove,
  canRemove,
}: GoodsReceiptNoteLineRowProps) {
  const { control } = useFormContext<CreateGoodsReceiptNoteInput>();

  return (
    <TableRow>
      <TableCell className="min-w-56">
        {linkedLine ? (
          <div className="text-sm text-foreground">
            {linkedLine.productName}
            {linkedLine.productCode ? ` (${linkedLine.productCode})` : ""}
            <p className="text-xs text-muted-foreground">
              Remaining: {linkedLine.remainingQuantity} {linkedLine.unitSymbol}
            </p>
          </div>
        ) : (
          <FormField
            control={control}
            name={`lines.${index}.productId`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ProductOptionSelector
                    options={productOptions}
                    value={field.value || undefined}
                    onChange={(value) => field.onChange(value ?? "")}
                    allowNone={false}
                    placeholder="Select a product"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </TableCell>

      <TableCell className="min-w-48">
        <FormField
          control={control}
          name={`lines.${index}.warehouseId`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <ProductOptionSelector
                  options={warehouseOptions}
                  value={field.value || undefined}
                  onChange={(value) => field.onChange(value ?? "")}
                  allowNone={false}
                  placeholder="Select a warehouse"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

      <TableCell>
        <FormField
          control={control}
          name={`lines.${index}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  min={0.0001}
                  step="0.0001"
                  style={{ width: numericFieldWidth(field.value) }}
                  {...field}
                  onChange={(event) => field.onChange(toNumberOrZero(event.target.valueAsNumber))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

      <TableCell>
        <FormField
          control={control}
          name={`lines.${index}.rejectedQuantity`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.0001"
                  style={{ width: numericFieldWidth(field.value) }}
                  {...field}
                  onChange={(event) => field.onChange(toNumberOrZero(event.target.valueAsNumber))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Remove line"
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 size={16} />
        </Button>
      </TableCell>
    </TableRow>
  );
}
