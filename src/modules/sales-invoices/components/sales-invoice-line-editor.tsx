"use client";

import * as React from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProductOptionItem } from "@/modules/products/components/product-option-selector";
import { SalesInvoiceLineRow } from "@/modules/sales-invoices/components/sales-invoice-line-row";
import type { CreateSalesInvoiceInput } from "@/modules/sales-invoices/validation/sales-invoice-schema";
import type { SalesInvoiceLineComputation, SalesInvoiceProductOption } from "@/types/sales-invoice";
import { useShortcutEffect } from "@/lib/shortcut-events";
import { ITEM_SEARCH_SHORTCUT_ATTRIBUTE, focusLastMarkedComboboxInput } from "@/lib/shortcut-dom-targets";

const BLANK_LINE = {
  productId: "" as unknown as string,
  quantity: 1,
  rate: 0,
  discountPercent: undefined,
  discountAmount: undefined,
  isTaxOverridden: false,
};

function productLabel(product: SalesInvoiceProductOption): string {
  const base = product.productCode ? `${product.name} (${product.productCode})` : product.name;
  return product.isActive ? base : `${base} (Inactive)`;
}

interface SalesInvoiceLineEditorProps {
  products: SalesInvoiceProductOption[];
  computations: SalesInvoiceLineComputation[];
  customerId: string | undefined;
  invoiceDate: string;
  isIntraState: boolean;
  /** True when reached from a Delivery Challan prefill — locks product/qty
   * and disables Add/Remove (mirrors delivery-challan-line-editor.tsx). */
  locked?: boolean;
}

/** Mirrors sales-order-line-editor.tsx, extended with a warehouse column and
 * the per-line tax-override control. Not extracted into a shared
 * DocumentLineEditor for the same reasons recorded in
 * sales-order-line-editor.tsx's file comment — this document's row shape
 * (warehouse + tax override) diverges further still. */
export function SalesInvoiceLineEditor({
  products,
  computations,
  customerId,
  invoiceDate,
  isIntraState,
  locked,
}: SalesInvoiceLineEditorProps) {
  const { control } = useFormContext<CreateSalesInvoiceInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });
  const containerRef = React.useRef<HTMLDivElement>(null);

  // "Add Line" / "Focus Item Search" keyboard shortcuts (src/config/
  // shortcuts.ts) — no-ops while locked to a Delivery Challan prefill,
  // exactly like the existing "Add Line" button's own disabled state.
  useShortcutEffect("add-line", () => {
    if (!locked) {
      append(BLANK_LINE);
    }
  });
  useShortcutEffect("focus-item-search", () => {
    if (containerRef.current) {
      focusLastMarkedComboboxInput(containerRef.current, ITEM_SEARCH_SHORTCUT_ATTRIBUTE);
    }
  });

  const productOptions: ProductOptionItem[] = React.useMemo(
    () => products.map((product) => ({ id: product.id, label: productLabel(product), isActive: product.isActive })),
    [products]
  );

  const productsById = React.useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const computationByLineNumber = React.useMemo(
    () => new Map(computations.map((computation) => [computation.lineNumber, computation])),
    [computations]
  );

  return (
    <div className="flex flex-col gap-3" ref={containerRef}>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Disc %</TableHead>
              <TableHead>Disc ₹</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead>Warnings</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <SalesInvoiceLineRow
                key={field.id}
                index={index}
                productOptions={productOptions}
                productsById={productsById}
                computation={computationByLineNumber.get(index + 1)}
                customerId={customerId}
                invoiceDate={invoiceDate}
                isIntraState={isIntraState}
                isOverridden={Boolean(lines?.[index]?.isTaxOverridden)}
                locked={locked}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {!locked ? (
        <Button type="button" variant="outline" size="sm" onClick={() => append(BLANK_LINE)}>
          <Plus size={16} />
          Add Line
        </Button>
      ) : null}
    </div>
  );
}
