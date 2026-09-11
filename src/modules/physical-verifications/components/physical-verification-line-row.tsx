"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { TableCell, TableRow } from "@/components/ui/table";
import { numericFieldWidth } from "@/lib/utils";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import type { CreatePhysicalVerificationInput } from "@/modules/physical-verifications/validation/physical-verification-schema";

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

function formatQuantity(value: number, decimalPlaces: number): string {
  return value.toFixed(decimalPlaces);
}

interface PhysicalVerificationLineRowProps {
  index: number;
  productOptions: ProductOptionItem[];
  unitDecimalPlacesByProduct: Map<string, number>;
  /** Live system-quantity-per-product snapshot for the header's currently
   * selected warehouse — undefined entries read as 0 (no movement history
   * yet), never as "unknown" (49-physical-verification.md's UI: "a live
   * system-quantity preview column"). Always advisory; the real value is
   * only ever computed server-side at completion. */
  stockPreview: Record<string, number>;
  onRemove: () => void;
  canRemove: boolean;
}

export function PhysicalVerificationLineRow({
  index,
  productOptions,
  unitDecimalPlacesByProduct,
  stockPreview,
  onRemove,
  canRemove,
}: PhysicalVerificationLineRowProps) {
  const { control } = useFormContext<CreatePhysicalVerificationInput>();
  const productId = useWatch({ control, name: `lines.${index}.productId` });
  const countedQuantity = useWatch({ control, name: `lines.${index}.countedQuantity` });

  const decimalPlaces = unitDecimalPlacesByProduct.get(productId) ?? 4;
  const systemQuantity = productId ? (stockPreview[productId] ?? 0) : null;
  const variance = systemQuantity === null ? null : toNumberOrZero(countedQuantity) - systemQuantity;

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

      <TableCell className="text-right font-financial text-muted-foreground">
        {systemQuantity === null ? "—" : formatQuantity(systemQuantity, decimalPlaces)}
      </TableCell>

      <TableCell>
        <FormField
          control={control}
          name={`lines.${index}.countedQuantity`}
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

      <TableCell className="text-right font-financial">
        {variance === null ? "—" : formatQuantity(variance, decimalPlaces)}
      </TableCell>

      <TableCell className="text-right">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove line" disabled={!canRemove} onClick={onRemove}>
          <Trash2 size={16} />
        </Button>
      </TableCell>
    </TableRow>
  );
}
