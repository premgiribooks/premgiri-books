"use client";

import { useFormContext } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { TableCell, TableRow } from "@/components/ui/table";
import { numericFieldWidth } from "@/lib/utils";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import type { CreateStockTransferInput } from "@/modules/stock-transfers/validation/stock-transfer-schema";

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

interface StockTransferLineRowProps {
  index: number;
  productOptions: ProductOptionItem[];
  onRemove: () => void;
  canRemove: boolean;
}

/** Product + quantity only — the source/destination warehouses are
 * header-level for the whole document (48-stock-transfer.md's Data Model:
 * "a single Stock Transfer document moves goods between exactly two
 * warehouses"), unlike stock-adjustment-line-row.tsx's per-line warehouse
 * picker. */
export function StockTransferLineRow({ index, productOptions, onRemove, canRemove }: StockTransferLineRowProps) {
  const { control } = useFormContext<CreateStockTransferInput>();

  return (
    <TableRow>
      <TableCell className="min-w-56">
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

      <TableCell className="text-right">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove line" disabled={!canRemove} onClick={onRemove}>
          <Trash2 size={16} />
        </Button>
      </TableCell>
    </TableRow>
  );
}
