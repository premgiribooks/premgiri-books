"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { TableCell, TableRow } from "@/components/ui/table";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import { resolveSalesOrderLinePriceAction } from "@/modules/sales-orders/actions/sales-order-actions";
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

  async function handleProductChange(productId: string | undefined) {
    setValue(`lines.${index}.productId`, productId ?? "", { shouldValidate: true });
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
      if (result.success && result.data && result.data.price !== null) {
        setValue(`lines.${index}.rate`, result.data.price, { shouldValidate: true });
      }
    } finally {
      setIsResolvingPrice(false);
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
      </TableCell>

      <TableCell className="w-28">
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
                  {...field}
                  onChange={(event) => field.onChange(toNumberOrZero(event.target.valueAsNumber))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

      <TableCell className="w-32">
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
                  {...field}
                  onChange={(event) => field.onChange(toNumberOrZero(event.target.valueAsNumber))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>

      <TableCell className="w-24">
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

      <TableCell className="w-28">
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

      <TableCell className="text-right font-financial">
        {computation ? computation.taxableAmount.toFixed(2) : "—"}
      </TableCell>
      <TableCell className="text-right font-financial">
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
