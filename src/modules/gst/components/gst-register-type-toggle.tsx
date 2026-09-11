import Link from "next/link";

import { cn } from "@/lib/utils";
import type { GstRegisterType } from "@/types/gst-report";

interface GstRegisterTypeToggleProps {
  active: GstRegisterType;
  /** The remaining query string (date range/filters/pagination) to preserve across the toggle. */
  queryString: string;
}

const OPTIONS: { value: GstRegisterType; label: string }[] = [
  { value: "OUTWARD", label: "Outward Register" },
  { value: "INWARD", label: "Inward Register" },
];

function hrefFor(type: GstRegisterType, queryString: string): string {
  const params = new URLSearchParams(queryString);
  params.set("type", type);
  params.delete("page");
  return `/gst/registers?${params.toString()}`;
}

export function GstRegisterTypeToggle({ active, queryString }: GstRegisterTypeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-border p-1">
      {OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={hrefFor(option.value, queryString)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
