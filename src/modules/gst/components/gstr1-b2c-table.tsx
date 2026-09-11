import { Gstr1ConsolidatedTable } from "@/modules/gst/components/gstr1-consolidated-table";
import { Gstr1DocumentGroupTable } from "@/modules/gst/components/gstr1-document-group-table";
import type { Gstr1ConsolidatedGroup, Gstr1DocumentGroup } from "@/types/gstr1";

type Gstr1B2cTableProps =
  | { variant: "large"; groups: Gstr1DocumentGroup[] }
  | { variant: "small"; groups: Gstr1ConsolidatedGroup[] };

/** Table 5 (B2C Large, invoice-wise) and Table 7 (B2C Small, consolidated
 * by place of supply + rate) — one component, switching row shape on the
 * `variant` prop (58-gstr-1.md's UI section). */
export function Gstr1B2cTable(props: Gstr1B2cTableProps) {
  if (props.variant === "large") {
    return (
      <Gstr1DocumentGroupTable
        title="Table 5 — B2C Large (Inter-State, > ₹2,50,000)"
        groups={props.groups}
        emptyMessage="No B2C Large invoices for this period."
      />
    );
  }
  return (
    <Gstr1ConsolidatedTable
      title="Table 7 — B2C Small (Consolidated)"
      groups={props.groups}
      emptyMessage="No B2C Small supplies for this period."
    />
  );
}
