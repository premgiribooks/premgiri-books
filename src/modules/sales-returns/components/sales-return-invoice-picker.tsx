"use client";

import * as React from "react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listReturnableInvoicesAction } from "@/modules/sales-returns/actions/sales-return-actions";
import { formatSalesReturnDate } from "@/modules/sales-returns/utils/format-sales-return-date";
import type { ReturnableInvoiceOption } from "@/types/sales-return";

const SEARCH_DEBOUNCE_MS = 300;

interface SalesReturnInvoicePickerProps {
  initialInvoices: ReturnableInvoiceOption[];
}

/** "New Sales Return"'s first step: search and pick a POSTED sales invoice
 * to return against (39-sales-return.md's UI: "starts from an invoice
 * search/select, then shows only that invoice's lines"). */
export function SalesReturnInvoicePicker({ initialInvoices }: SalesReturnInvoicePickerProps) {
  const [search, setSearch] = React.useState("");
  const [invoices, setInvoices] = React.useState(initialInvoices);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setIsLoading(true);
      listReturnableInvoicesAction(search || undefined)
        .then((result) => {
          if (result.success && result.data) {
            setInvoices(result.data);
          }
        })
        .finally(() => setIsLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search invoice number or customer…"
        className="sm:max-w-xs"
        aria-label="Search posted sales invoices"
      />

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Searching…" : "No posted sales invoices found."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium text-foreground">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.customerName ?? "—"}</TableCell>
                  <TableCell className="font-financial">{formatSalesReturnDate(invoice.invoiceDate)}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/sales/returns/new?salesInvoiceId=${invoice.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Select
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
