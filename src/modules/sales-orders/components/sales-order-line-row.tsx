"use client";

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { TableCell, TableRow } from "@/components/ui/table";
import { numericFieldWidth } from "@/lib/utils";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import { resolveSalesOrderLinePriceAction } from "@/modules/sales-orders/actions/sales-order-actions";
import { useMarginOverride } from "@/hooks/use-margin-override";
import { previewMarginOverrideRateAction } from "@/lib/margin-override-actions";
import type { CreateSalesOrderInput } from "@/modules/sales-orders/validation/sales-order-schema";
import type { SalesOrderLineComputation } from "@/types/sales-order";

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

interface SalesOrderLineRowProps {
  index: number;
  productOptions: ProductOptionItem[];
  computation?: SalesOrderLineComputation;
  customerId: string | undefined;
  orderDate: string;
  onRemove: () => void;
  canRemove: boolean;
}

/** Mirrors quotation-line-row.tsx exactly. Not extracted into a shared
 * `DocumentLineEditor` — see sales-order-line-editor.tsx's file comment for
 * the extraction decision this and that file share. */
export function SalesOrderLineRow({
  index,
  productOptions,
  computation,
  customerId,
  orderDate,
  onRemove,
  canRemove,
}: SalesOrderLineRowProps) {
  const { control, setValue, getValues } = useFormContext<CreateSalesOrderInput>();
  const [isResolvingPrice, setIsResolvingPrice] = React.useState(false);

  // Temporary margin override (Ctrl+Shift+M) — writes the override-computed
  // rate directly into the `rate` field, same as normal price resolution.
  // See src/components/margin-override/margin-override-dialog.tsx.
  const marginOverride = useMarginOverride();
  const [resolvedCost, setResolvedCost] = React.useState<number | null>(null);
  const watchedProductId = useWatch({ control, name: `lines.${index}.productId` });
  const watchedQuantity = useWatch({ control, name: `lines.${index}.quantity` });

  async function handleProductChange(productId: string | undefined) {
    setValue(`lines.${index}.productId`, productId ?? "", { shouldValidate: true });
    setResolvedCost(null);
    if (!productId) {
      return;
    }

    const quantity = getValues(`lines.${index}.quantity`) || 1;
    setIsResolvingPrice(true);
    try {
      const result = await resolveSalesOrderLinePriceAction({
        productId,
        quantity,
        customerId,
        asOfDate: orderDate || undefined,
      });
      if (result.success && result.data) {
        setResolvedCost(result.data.purchaseCost);
        if (result.data.price !== null) {
          setValue(`lines.${index}.rate`, result.data.price, { shouldValidate: true });
        }
      }
    } finally {
      setIsResolvingPrice(false);
    }
  }

  // Lazily resolves purchase cost for an already-selected line (edit mode)
  // once an override is active.
  React.useEffect(() => {
    if (!marginOverride || !watchedProductId || resolvedCost !== null) {
      return;
    }
    let cancelled = false;
    void resolveSalesOrderLinePriceAction({
      productId: watchedProductId,
      quantity: watchedQuantity || 1,
      customerId,
      asOfDate: orderDate || undefined,
    }).then((result) => {
      if (!cancelled && result.success && result.data) {
        setResolvedCost(result.data.purchaseCost);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [marginOverride, watchedProductId, watchedQuantity, resolvedCost, customerId, orderDate]);

  // Applies the override rate straight into the form field — downstream
  // taxable/tax/total figures follow through the form's own live-preview
  // debounce, exactly like any other rate change.
  React.useEffect(() => {
    if (!marginOverride || resolvedCost === null) {
      return;
    }
    let cancelled = false;
    void previewMarginOverrideRateAction({ purchaseCost: resolvedCost, marginPercent: marginOverride.marginPercent }).then(
      (result) => {
        if (!cancelled && result.success && result.data !== null && result.data !== undefined) {
          setValue(`lines.${index}.rate`, result.data, { shouldValidate: true });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [marginOverride, resolvedCost, index, setValue]);

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
                  onChange={(value) => void handleProductChange(value)}
                  allowNone={false}
                  placeholder={isResolvingPrice ? "Resolving price…" : "Select a product"}
                  disabled={isResolvingPrice}
                  isLoading={isResolvingPrice}
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
            {computation.isBelowCost ? (
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                Below Cost
              </Badge>
            ) : null}
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
