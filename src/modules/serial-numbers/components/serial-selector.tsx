"use client";

import * as React from "react";

import { SearchableSelect } from "@/components/common/searchable-select";
import { listSerialOptionsAction } from "@/modules/serial-numbers/actions/serial-number-actions";
import type { SerialNumberOption } from "@/types/serial-number";

interface SerialSelectorProps {
  productId: string | undefined;
  /** Narrows the fetched serials to those currently IN_STOCK at this warehouse (51-serial-number-tracking.md's identity-scoped availability). */
  warehouseId?: string;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * Reusable, filterable serial picker (51-serial-number-tracking.md's UI
 * section) — mirrors `<BatchSelector>`'s self-fetching convention exactly,
 * filtered to currently IN_STOCK serials for an OUT-direction line. Not
 * wired into any document by this task (see the spec's Retrofit note); a
 * future line editor composes this the same way one would compose
 * `<BatchSelector>`.
 */
export function SerialSelector({
  productId,
  warehouseId,
  value,
  onChange,
  disabled,
  ...triggerProps
}: SerialSelectorProps) {
  const [options, setOptions] = React.useState<SerialNumberOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    // Deferred via setTimeout — mirrors batch-selector.tsx's identical
    // convention (react-hooks/set-state-in-effect).
    const handle = setTimeout(() => {
      setIsLoading(true);

      const request = productId
        ? listSerialOptionsAction(productId, warehouseId)
        : Promise.resolve({ success: true as const, data: [] as SerialNumberOption[] });

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
  const placeholder = !productId ? "Select a product first" : isLoading ? "Loading serials…" : "Select a serial number";

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      getOptionId={(option) => option.id}
      getOptionLabel={(option) => option.serialValue}
      emptyLabel="No serials in stock"
      placeholder={placeholder}
      disabled={isDisabled}
      isLoading={isLoading}
      {...triggerProps}
    />
  );
}
