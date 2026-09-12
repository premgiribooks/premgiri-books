import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StockLedgerReport } from "@/types/inventory-report";

interface StockLedgerTableProps {
  report: StockLedgerReport;
}

function formatLedgerDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

export function StockLedgerTable({ report }: StockLedgerTableProps) {
  if (report.lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No stock movements found for {report.productName} in the selected range.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Warehouse</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Direction</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead className="text-right">Running Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.lines.map((line) => (
          <TableRow key={line.id}>
            <TableCell className="font-financial">{formatLedgerDate(line.transactionDate)}</TableCell>
            <TableCell>{line.warehouseName ?? "—"}</TableCell>
            <TableCell>
              <div>{line.referenceLabel}</div>
              {line.narration ? <div className="text-xs text-muted-foreground">{line.narration}</div> : null}
            </TableCell>
            <TableCell className={line.direction === "IN" ? "text-success" : "text-destructive"}>
              {line.direction === "IN" ? "IN" : "OUT"}
            </TableCell>
            <TableCell className="text-right font-financial">{line.quantity.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial font-medium">{line.runningBalance.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={5} className="text-right font-medium">
            Closing Balance
          </TableCell>
          <TableCell className="text-right font-financial font-medium">{report.closingBalance.toFixed(2)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
