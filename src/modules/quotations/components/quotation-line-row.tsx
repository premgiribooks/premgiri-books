"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { TableCell, TableRow } from "@/components/ui/table";
import { numericFieldWidth } from "@/lib/utils";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import { resolveLinePriceAction } from "@/modules/quotations/actions/quotation-actions";
import type { CreateQuotationInput } from "@/modules/quotations/validation/quotation-schema";
import type { QuotationLineComputation } from "@/types/quotation";

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

interface QuotationLineRowProps {
  index: number;
  productOptions: ProductOptionItem[];
  computation?: QuotationLineComputation;
  customerId: string | undefined;
  quotationDate: string;
  onRemove: () => void;
  canRemove: boolean;
}

export function QuotationLineRow({
  index,
  productOptions,
  computation,
  customerId,
  quotationDate,
  onRemove,
  canRemove,
}: QuotationLineRowProps) {
  const { control, setValue, getValues } = useFormContext<CreateQuotationInput>();
  const [isResolvingPrice, setIsResolvingPrice] = React.useState(false);

  // Prefills `rate` via the Pricing Engine when a product is selected — the
  // resolved value is always overridable afterwards (35-quotations.md's
  // Business Rules: "no permission gate on override here").
  async function handleProductChange(productId: string | undefined) {
    setValue(`lines.${index}.productId`, productId ?? "", { shouldValidate: true });
    if (!productId) {
      return;
    }

    const quantity = getValues(`lines.${index}.quantity`) || 1;
    setIsResolvingPrice(true);
    try {
      const result = await resolveLinePriceAction({
        productId,
        quantity,
        customerId,
        asOfDate: quotationDate || undefined,
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

      {/* Read-only, server-computed — never calculated in the browser
          (35-quotations.md's UI). Blank until the debounced preview lands.
          Same grow-with-content treatment as the inputs above, so the
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
