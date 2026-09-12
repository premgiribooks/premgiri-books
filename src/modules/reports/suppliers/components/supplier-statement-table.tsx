import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SupplierStatementReport } from "@/types/supplier-report";

interface SupplierStatementTableProps {
  report: SupplierStatementReport;
}

function formatStatementDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

export function SupplierStatementTable({ report }: SupplierStatementTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Voucher</TableHead>
          <TableHead className="text-right">Debit</TableHead>
          <TableHead className="text-right">Credit</TableHead>
          <TableHead className="text-right">Running Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={4} className="text-right font-medium">
            Opening Balance
          </TableCell>
          <TableCell className="text-right font-financial font-medium">{report.openingBalance.toFixed(2)}</TableCell>
        </TableRow>
        {report.lines.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
              No voucher entries found for {report.supplierName} in the selected range.
            </TableCell>
          </TableRow>
        ) : (
          report.lines.map((line) => (
            <TableRow key={line.voucherId}>
              <TableCell className="font-financial">{formatStatementDate(line.voucherDate)}</TableCell>
              <TableCell>
                <div>
                  {line.voucherTypeLabel} #{line.voucherNumber}
                </div>
                {line.narration ? <div className="text-xs text-muted-foreground">{line.narration}</div> : null}
              </TableCell>
              <TableCell className="text-right font-financial">{line.debit === 0 ? "—" : line.debit.toFixed(2)}</TableCell>
              <TableCell className="text-right font-financial">{line.credit === 0 ? "—" : line.credit.toFixed(2)}</TableCell>
              <TableCell className="text-right font-financial font-medium">{line.runningBalance.toFixed(2)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={4} className="text-right font-medium">
            Closing Balance
          </TableCell>
          <TableCell className="text-right font-financial font-medium">{report.closingBalance.toFixed(2)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
