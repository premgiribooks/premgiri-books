import { Gstr1DocumentGroupTable } from "@/modules/gst/components/gstr1-document-group-table";
import type { Gstr1DocumentGroup } from "@/types/gstr1";

interface Gstr1B2bTableProps {
  groups: Gstr1DocumentGroup[];
}

/** Table 4 — B2B (registered recipients), invoice-wise. */
export function Gstr1B2bTable({ groups }: Gstr1B2bTableProps) {
  return (
    <Gstr1DocumentGroupTable
      title="Table 4 — B2B (Registered Recipients)"
      groups={groups}
      emptyMessage="No B2B invoices for this period."
    />
  );
}
