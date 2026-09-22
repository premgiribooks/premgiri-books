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
import { resolveLinePriceAction } from "@/modules/sales-invoices/actions/sales-invoice-actions";
import { ITEM_SEARCH_SHORTCUT_ATTRIBUTE } from "@/lib/shortcut-dom-targets";
import { SalesInvoiceTaxOverridePopover } from "@/modules/sales-invoices/components/sales-invoice-tax-override-popover";
import { useMarginOverride } from "@/hooks/use-margin-override";
import { previewMarginOverrideRateAction } from "@/lib/margin-override-actions";
import type { CreateSalesInvoiceInput } from "@/modules/sales-invoices/validation/sales-invoice-schema";
import type { SalesInvoiceLineComputation, SalesInvoiceProductOption } from "@/types/sales-invoice";

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

interface SalesInvoiceLineRowProps {
  index: number;
  productOptions: ProductOptionItem[];
  /** Keyed by product id — looked up for the selected line's product to show
   * current stock (across all warehouses) right after the item name, so
   * billing staff can see what's available while creating the sale. */
  productsById: ReadonlyMap<string, SalesInvoiceProductOption>;
  computation?: SalesInvoiceLineComputation;
  customerId: string | undefined;
  invoiceDate: string;
  isIntraState: boolean;
  isOverridden: boolean;
  /** Locked (product/quantity fixed, no removal) when pre-filled from a
   * Delivery Challan — mirrors delivery-challan-line-row.tsx's linkedLine
   * lock. */
  locked?: boolean;
  onRemove: () => void;
  canRemove: boolean;
}

/** Mirrors sales-order-line-row.tsx, extended with the per-line
 * tax-override popover (this document's own addition). No warehouse picker
 * — which warehouse(s) fulfil this line is resolved automatically at
 * posting time (removed the manual per-line picker per explicit user
 * request, 2026-09-20; see sales-invoice-service.ts's
 * resolveWarehouseAllocationsForLines). */
export function SalesInvoiceLineRow({
  index,
  productOptions,
  productsById,
  computation,
  customerId,
  invoiceDate,
  isIntraState,
  isOverridden,
  locked,
  onRemove,
  canRemove,
}: SalesInvoiceLineRowProps) {
  const { control, setValue, getValues } = useFormContext<CreateSalesInvoiceInput>();
  const [isResolvingPrice, setIsResolvingPrice] = React.useState(false);

  // Temporary margin override (Ctrl+Shift+M) — writes the override-computed
  // rate directly into the `rate` field, same as a normal price resolution,
  // per explicit user request: what you see is what saves unless manually
  // reverted before clicking Save. See
  // src/components/margin-override/margin-override-dialog.tsx and its
  // navbar CM badge (the one on-screen indicator — no per-line detail here).
  const marginOverride = useMarginOverride();
  const [resolvedCost, setResolvedCost] = React.useState<number | null>(null);
  const watchedProductId = useWatch({ control, name: `lines.${index}.productId` });
  const watchedQuantity = useWatch({ control, name: `lines.${index}.quantity` });
  const selectedProduct = watchedProductId ? productsById.get(watchedProductId) : undefined;

  async function handleProductChange(productId: string | undefined) {
    setValue(`lines.${index}.productId`, productId ?? "", { shouldValidate: true });
    setResolvedCost(null);
    if (!productId) {
      return;
    }
    const quantity = getValues(`lines.${index}.quantity`) || 1;
    setIsResolvingPrice(true);
    try {
      const result = await resolveLinePriceAction({ productId, quantity, customerId, asOfDate: invoiceDate || undefined });
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

  // Lazily resolves purchase cost for an already-selected line (edit mode,
  // or a line the user isn't actively re-picking) once an override is
  // active — read-only, never touches the `rate` field.
  React.useEffect(() => {
    if (!marginOverride || !watchedProductId || resolvedCost !== null) {
      return;
    }
    let cancelled = false;
    void resolveLinePriceAction({
      productId: watchedProductId,
      quantity: watchedQuantity || 1,
      customerId,
      asOfDate: invoiceDate || undefined,
    }).then((result) => {
      if (!cancelled && result.success && result.data) {
        setResolvedCost(result.data.purchaseCost);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [marginOverride, watchedProductId, watchedQuantity, resolvedCost, customerId, invoiceDate]);

  // Applies the override rate straight into the form field (re-applies
  // whenever the active margin % changes, or once resolvedCost first
  // resolves) — the resulting taxable/tax/total figures follow automatically
  // through the form's own live-preview debounce (sales-invoice-form.tsx),
  // exactly like any other rate change.
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
      <TableCell className="min-w-80" {...{ [ITEM_SEARCH_SHORTCUT_ATTRIBUTE]: "" }}>
        {locked ? (
          <FormField
            control={control}
            name={`lines.${index}.productId`}
            render={({ field }) => (
              <div className="text-sm text-foreground">
                {productOptions.find((option) => option.id === field.value)?.label ?? field.value}
              </div>
            )}
          />
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
                    onChange={(value) => void handleProductChange(value)}
                    allowNone={false}
                    placeholder={isResolvingPrice ? "Resolving price…" : "Select a product"}
                    disabled={isResolvingPrice}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {selectedProduct ? (
          <p
            className={
              "mt-1 text-xs " +
              ((selectedProduct.availableQuantity ?? 0) < (watchedQuantity || 0) ? "text-destructive" : "text-muted-foreground")
            }
          >
            Available: {(selectedProduct.availableQuantity ?? 0).toFixed(selectedProduct.unitDecimalPlaces)}{" "}
            {selectedProduct.unitSymbol}
          </p>
        ) : null}
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
                  disabled={locked}
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
                    field.onChange(Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber)
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
                    field.onChange(Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

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
        <SalesInvoiceTaxOverridePopover index={index} isIntraState={isIntraState} isOverridden={isOverridden} />
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
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
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
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove line" disabled={!canRemove || locked} onClick={onRemove}>
          <Trash2 size={16} />
        </Button>
      </TableCell>
    </TableRow>
  );
}
