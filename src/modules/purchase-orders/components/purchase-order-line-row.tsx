"use client";

import { useFormContext } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { TableCell, TableRow } from "@/components/ui/table";
import { numericFieldWidth } from "@/lib/utils";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import type { CreatePurchaseOrderInput } from "@/modules/purchase-orders/validation/purchase-order-schema";
import type { PurchaseOrderLineComputation, PurchaseOrderProductOption } from "@/types/purchase-order";

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

interface PurchaseOrderLineRowProps {
  index: number;
  productOptions: ProductOptionItem[];
  productsById: ReadonlyMap<string, PurchaseOrderProductOption>;
  computation?: PurchaseOrderLineComputation;
  onRemove: () => void;
  canRemove: boolean;
}

/** Mirrors sales-order-line-row.tsx, minus the pricing-engine round trip:
 * selecting a product prefills `rate` directly from the product's own
 * `purchasePrice` (the cost basis) — no server call, no `resolvePrice`
 * (42-purchase-orders.md's Data Model: "every Purchase document simply uses
 * `product.purchasePrice` as a starting suggestion, always manually
 * overridable"). Not extracted into a shared `DocumentLineEditor`, the same
 * YAGNI reasoning sales-order-line-editor.tsx's file comment records. */
export function PurchaseOrderLineRow({
  index,
  productOptions,
  productsById,
  computation,
  onRemove,
  canRemove,
}: PurchaseOrderLineRowProps) {
  const { control, setValue } = useFormContext<CreatePurchaseOrderInput>();

  function handleProductChange(productId: string | undefined) {
    setValue(`lines.${index}.productId`, productId ?? "", { shouldValidate: true });
    if (!productId) {
      return;
    }

    const product = productsById.get(productId);
    if (product?.purchasePrice !== null && product?.purchasePrice !== undefined) {
      setValue(`lines.${index}.rate`, product.purchasePrice, { shouldValidate: true });
    }
  }

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
                  onChange={handleProductChange}
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

      <TableCell>
        <FormField
          control={control}
          name={`lines.${index}.rate`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
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
          name={`lines.${index}.discountPercent`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={field.value ?? ""}
                  style={{ width: numericFieldWidth(field.value) }}
                  onChange={(event) =>
                    field.onChange(
                      Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber
                    )
                  }
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
          name={`lines.${index}.discountAmount`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={field.value ?? ""}
                  style={{ width: numericFieldWidth(field.value) }}
                  onChange={(event) =>
                    field.onChange(
                      Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

      {/* Same grow-with-content treatment as the inputs above, so the
          numeric columns don't visually jump in width relative to each
          other. */}
      <TableCell
        className="text-right font-financial"
        style={{ minWidth: numericFieldWidth(computation ? computation.taxableAmount.toFixed(2) : "") }}
      >
        {computation ? computation.taxableAmount.toFixed(2) : "—"}
      </TableCell>
      <TableCell
        className="text-right font-financial"
        style={{ minWidth: numericFieldWidth(computation ? computation.totalAmount.toFixed(2) : "") }}
      >
        {computation ? computation.totalAmount.toFixed(2) : "—"}
      </TableCell>

      <TableCell>
        {computation ? (
          <div className="flex flex-wrap gap-1">
            {computation.isHsnMissing ? (
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                No HSN
              </Badge>
            ) : null}
            {computation.isGstRateMissing ? (
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                No GST Rate
              </Badge>
            ) : null}
          </div>
        ) : null}
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
