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
import type { CreateDeliveryChallanInput } from "@/modules/delivery-challans/validation/delivery-challan-schema";
import type { OpenSalesOrderLineOption } from "@/types/delivery-challan";

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

interface DeliveryChallanLineRowProps {
  index: number;
  productOptions: ProductOptionItem[];
  /** Set when this row is locked to a linked Sales Order's line — the
   * product is fixed (shown as a label, no picker) and quantity is capped at
   * the order line's remaining quantity. */
  linkedLine?: OpenSalesOrderLineOption;
  onRemove: () => void;
  canRemove: boolean;
}

/** One line of the Delivery Challan Form's editor — no pricing/tax columns,
 * unlike sales-order-line-row.tsx/quotation-line-row.tsx, and no warehouse
 * picker either (removed per explicit user request, 2026-09-20 — this
 * document never moves real stock). */
export function DeliveryChallanLineRow({
  index,
  productOptions,
  linkedLine,
  onRemove,
  canRemove,
}: DeliveryChallanLineRowProps) {
  const { control } = useFormContext<CreateDeliveryChallanInput>();

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
                  max={linkedLine ? linkedLine.remainingQuantity : undefined}
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
