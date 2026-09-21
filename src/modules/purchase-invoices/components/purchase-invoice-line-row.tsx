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
import { PurchaseInvoiceTaxOverridePopover } from "@/modules/purchase-invoices/components/purchase-invoice-tax-override-popover";
import { ITEM_SEARCH_SHORTCUT_ATTRIBUTE } from "@/lib/shortcut-dom-targets";
import type { CreatePurchaseInvoiceInput } from "@/modules/purchase-invoices/validation/purchase-invoice-schema";
import type { PurchaseInvoiceLineComputation, PurchaseInvoiceProductOption } from "@/types/purchase-invoice";

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

interface PurchaseInvoiceLineRowProps {
  index: number;
  productOptions: ProductOptionItem[];
  warehouseOptions: ProductOptionItem[];
  productsById: ReadonlyMap<string, PurchaseInvoiceProductOption>;
  computation?: PurchaseInvoiceLineComputation;
  isIntraState: boolean;
  isOverridden: boolean;
  /** Locked (product/warehouse/quantity fixed, no removal) when pre-filled
   * from a Goods Receipt Note — mirrors sales-invoice-line-row.tsx's
   * `locked` prop for a Delivery Challan prefill. */
  locked?: boolean;
  onRemove: () => void;
  canRemove: boolean;
}

/** Mirrors purchase-order-line-row.tsx's no-pricing-engine `purchasePrice`
 * prefill, extended with a warehouse picker (this document records stock
 * movement, unlike Purchase Order) and the per-line tax-override popover
 * (mirrors sales-invoice-line-row.tsx's identical addition). */
export function PurchaseInvoiceLineRow({
  index,
  productOptions,
  warehouseOptions,
  productsById,
  computation,
  isIntraState,
  isOverridden,
  locked,
  onRemove,
  canRemove,
}: PurchaseInvoiceLineRowProps) {
  const { control, setValue } = useFormContext<CreatePurchaseInvoiceInput>();

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
                    onChange={handleProductChange}
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
                  disabled={locked}
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
        <PurchaseInvoiceTaxOverridePopover index={index} isIntraState={isIntraState} isOverridden={isOverridden} />
      </TableCell>

      <TableCell>
        {computation ? (
          <div className="flex flex-wrap gap-1">
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
