import { Gstr1ConsolidatedTable } from "@/modules/gst/components/gstr1-consolidated-table";
import { Gstr1DocumentGroupTable } from "@/modules/gst/components/gstr1-document-group-table";
import type { Gstr1ConsolidatedGroup, Gstr1DocumentGroup } from "@/types/gstr1";

interface Gstr1CreditDebitNoteTableProps {
  registered: Gstr1DocumentGroup[];
  unregistered: Gstr1ConsolidatedGroup[];
}

/** Table 9B/9C — Credit/Debit Notes, split registered (invoice-wise) vs.
 * unregistered (consolidated). Sales Return lines never appear here
 * (58-gstr-1.md's Project Context) — only real CreditNote/DebitNote rows. */
export function Gstr1CreditDebitNoteTable({ registered, unregistered }: Gstr1CreditDebitNoteTableProps) {
  return (
    <div className="flex flex-col gap-6">
      <Gstr1DocumentGroupTable
        title="Table 9B — Credit/Debit Notes (Registered)"
        groups={registered}
        emptyMessage="No credit/debit notes against registered recipients for this period."
      />
      <Gstr1ConsolidatedTable
        title="Table 9C — Credit/Debit Notes (Unregistered)"
        groups={unregistered}
        emptyMessage="No credit/debit notes against unregistered recipients for this period."
      />
    </div>
  );
}
