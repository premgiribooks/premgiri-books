"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GstFilingPeriodOption } from "@/modules/gst/utils/gst-filing-periods";

interface Gstr1PeriodSelectorProps {
  options: GstFilingPeriodOption[];
}

/** Month or quarter picker (options pre-computed server-side from
 * CompanySettings.gstFilingFrequency and the active Financial Year) — sets
 * from/to URL params, the same URL-state pattern every filter bar in this
 * module uses. */
export function Gstr1PeriodSelector({ options }: Gstr1PeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentFrom = searchParams.get("from");
  const currentValue = options.find((option) => option.from === currentFrom)?.value ?? options[0]?.value ?? "";

  function handleChange(value: string | null) {
    const selected = options.find((option) => option.value === value);
    if (!selected) {
      return;
    }
    const params = new URLSearchParams(searchParams);
    params.set("from", selected.from);
    params.set("to", selected.to);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={currentValue} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-56" aria-label="Filing period">
        <SelectValue>{(current: string | null) => options.find((o) => o.value === current)?.label ?? "Select a period"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
