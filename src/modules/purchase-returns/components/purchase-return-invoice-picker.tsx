"use client";

import * as React from "react";
import Link from "next/link";

import { LoadingBar } from "@/components/common/loading-bar";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listReturnablePurchaseInvoicesAction } from "@/modules/purchase-returns/actions/purchase-return-actions";
import { formatPurchaseReturnDate } from "@/modules/purchase-returns/utils/format-purchase-return-date";
import type { ReturnablePurchaseInvoiceOption } from "@/types/purchase-return";

const SEARCH_DEBOUNCE_MS = 300;

interface PurchaseReturnInvoicePickerProps {
  initialInvoices: ReturnablePurchaseInvoiceOption[];
}

/** "New Purchase Return"'s first step: search and pick a POSTED purchase
 * invoice to return against (45-purchase-return.md's UI: "starts from an
 * invoice search/select, then shows only that invoice's lines"). */
export function PurchaseReturnInvoicePicker({ initialInvoices }: PurchaseReturnInvoicePickerProps) {
  const [search, setSearch] = React.useState("");
  const [invoices, setInvoices] = React.useState(initialInvoices);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setIsLoading(true);
      listReturnablePurchaseInvoicesAction(search || undefined)
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
      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search invoice number or supplier…"
          className="sm:max-w-xs"
          aria-label="Search posted purchase invoices"
        />
        {isLoading ? <LoadingBar className="w-12" label="Searching" /> : null}
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          {isLoading ? (
            <LoadingBar className="w-32" label="Searching" />
          ) : (
            <p className="text-sm text-muted-foreground">No posted purchase invoices found.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium text-foreground">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.supplierName}</TableCell>
                  <TableCell className="font-financial">{formatPurchaseReturnDate(invoice.invoiceDate)}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/purchase/returns/new?purchaseInvoiceId=${invoice.id}`}
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
