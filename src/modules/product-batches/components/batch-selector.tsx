"use client";

import * as React from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listBatchOptionsAction } from "@/modules/product-batches/actions/product-batch-actions";
import { formatProductBatchDate } from "@/modules/product-batches/utils/format-product-batch-date";
import type { ProductBatchOption } from "@/types/product-batch";

const NONE_VALUE = "__none__";
const EMPTY_VALUE = "__no_batches__";
const LOADING_VALUE = "__loading__";

interface BatchSelectorProps {
  productId: string | undefined;
  /** Narrows the fetched batches' currentStock to one warehouse's own stock (50-batch-tracking.md's batch-scoped availability). */
  warehouseId?: string;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

function optionLabel(option: ProductBatchOption): string {
  const expiry = option.expiryDate ? ` — Exp. ${formatProductBatchDate(option.expiryDate)}` : "";
  return `${option.batchNumber} (${option.currentStock} in stock)${expiry}`;
}

/**
 * Reusable batch picker (50-batch-tracking.md's UI section) — the one piece
 * of UI this spec ships that other documents' line editors will later
 * import once each is retrofitted (see the spec's Retrofit Decision; not
 * wired into any document by this task). Self-fetches its options via
 * `listBatchOptionsAction` whenever `productId`/`warehouseId` changes, so a
 * consuming line editor only needs to pass the selected product/warehouse
 * and a controlled `value`.
 */
export function BatchSelector({
  productId,
  warehouseId,
  value,
  onChange,
  disabled,
  ...triggerProps
}: BatchSelectorProps) {
  const [options, setOptions] = React.useState<ProductBatchOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    // Deferred via setTimeout (purchase-return-invoice-picker.tsx's identical
    // convention) so the loading flag is set from a callback, not
    // synchronously in the effect body (react-hooks/set-state-in-effect).
    const handle = setTimeout(() => {
      setIsLoading(true);

      const request = productId
        ? listBatchOptionsAction(productId, warehouseId)
        : Promise.resolve({ success: true as const, data: [] as ProductBatchOption[] });

      request
        .then((result) => {
          if (cancelled) {
            return;
          }
          setOptions(result.success && result.data ? result.data : []);
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [productId, warehouseId]);

  const isDisabled = disabled || !productId || isLoading;
  const placeholder = !productId ? "Select a product first" : isLoading ? "Loading batches…" : "Select a batch";

  return (
    <Select
      value={value ?? NONE_VALUE}
      onValueChange={(next) => onChange(!next || next === NONE_VALUE ? undefined : next)}
      disabled={isDisabled}
    >
      <SelectTrigger className="w-full" {...triggerProps}>
        <SelectValue placeholder={placeholder}>
          {(current: string | null) => {
            if (!current || current === NONE_VALUE) {
              return placeholder;
            }
            const selected = options.find((option) => option.id === current);
            return selected ? optionLabel(selected) : placeholder;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {isLoading ? (
          <SelectItem value={LOADING_VALUE} disabled>
            Loading…
          </SelectItem>
        ) : options.length === 0 ? (
          <SelectItem value={EMPTY_VALUE} disabled>
            No active batches
          </SelectItem>
        ) : (
          options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {optionLabel(option)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
