"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CREDIT_NOTE_STATUS_LABELS } from "@/modules/credit-notes/components/credit-note-status-badge";
import { CREDIT_NOTE_STATUS_VALUES } from "@/modules/credit-notes/validation/credit-note-schema";
import type { CreditNoteCustomerOption } from "@/types/credit-note";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

interface CreditNoteFilterBarProps {
  customers: CreditNoteCustomerOption[];
}

/** Search + status/customer filter for the credit note list — mirrors
 * sales-return-filter-bar.tsx's URL-state pattern exactly. */
export function CreditNoteFilterBar({ customers }: CreditNoteFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("search") ?? "");

  const updateParams = React.useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === ALL_VALUE) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams]
  );

  React.useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (search === current) {
      return;
    }
    const handle = setTimeout(() => updateParams({ search: search || undefined }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, searchParams, updateParams]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search note or invoice number, or customer…"
        className="sm:max-w-xs"
        aria-label="Search credit notes"
      />

      <Select
        value={searchParams.get("status") ?? ALL_VALUE}
        onValueChange={(next) => updateParams({ status: next ?? ALL_VALUE })}
      >
        <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
          <SelectValue>
            {(current: string | null) =>
              CREDIT_NOTE_STATUS_VALUES.includes(current as (typeof CREDIT_NOTE_STATUS_VALUES)[number])
                ? CREDIT_NOTE_STATUS_LABELS[current as (typeof CREDIT_NOTE_STATUS_VALUES)[number]]
                : "All Statuses"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
          {CREDIT_NOTE_STATUS_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {CREDIT_NOTE_STATUS_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("customerId") ?? ALL_VALUE}
        onValueChange={(next) => updateParams({ customerId: next ?? ALL_VALUE })}
      >
        <SelectTrigger className="w-full sm:w-48" aria-label="Filter by customer">
          <SelectValue>
            {(current: string | null) => customers.find((customer) => customer.id === current)?.name ?? "All Customers"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All Customers</SelectItem>
          {customers.map((customer) => (
            <SelectItem key={customer.id} value={customer.id}>
              {customer.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
