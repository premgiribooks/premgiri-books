"use client";

import * as React from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductOptionItem } from "@/modules/products/components/product-option-selector";
import { SalesOrderLineRow } from "@/modules/sales-orders/components/sales-order-line-row";
import type { CreateSalesOrderInput } from "@/modules/sales-orders/validation/sales-order-schema";
import type { SalesOrderLineComputation, SalesOrderProductOption } from "@/types/sales-order";

const BLANK_LINE = {
  productId: "" as unknown as string,
  quantity: 1,
  rate: 0,
  discountPercent: undefined,
  discountAmount: undefined,
};

function productLabel(product: SalesOrderProductOption): string {
  const base = `${product.name} (${product.productCode})`;
  return product.isActive ? base : `${base} (Inactive)`;
}

interface SalesOrderLineEditorProps {
  products: SalesOrderProductOption[];
  computations: SalesOrderLineComputation[];
  customerId: string | undefined;
  orderDate: string;
}

/**
 * The Sales Order Form's line-item editor — mirrors
 * quotation-line-editor.tsx exactly.
 *
 * Not extracted into a shared `DocumentLineEditor` under
 * `src/components/sales/`, per 36-sales-orders.md's own instruction to
 * "decide during implementation and record which": the line shape is
 * identical to Quotation's, but both `quotation-line-row.tsx` and this file
 * are tightly generic-bound to their own form's inferred input type
 * (`useFormContext<CreateQuotationInput>()` vs
 * `useFormContext<CreateSalesOrderInput>()`), and Quotation's row also wires
 * a Quotation-specific action (`resolveLinePriceAction`). Genericizing both
 * to share one component — over a generic type param plus an injected
 * price-resolve callback — is real, non-trivial work for exactly two call
 * sites today; per coding-style.md's YAGNI, that abstraction is deferred
 * until a third document (Delivery Challan, feature-spec 37, whose lines are
 * read-only fulfillment rows rather than a priced editor, likely won't
 * qualify either) makes the duplication cost concrete rather than
 * speculative. See progress-tracker.md for this decision's record.
 */
export function SalesOrderLineEditor({
  products,
  computations,
  customerId,
  orderDate,
}: SalesOrderLineEditorProps) {
  const { control } = useFormContext<CreateSalesOrderInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const productOptions: ProductOptionItem[] = React.useMemo(
    () => products.map((product) => ({ id: product.id, label: productLabel(product), isActive: product.isActive })),
    [products]
  );

  const computationByLineNumber = React.useMemo(
    () => new Map(computations.map((computation) => [computation.lineNumber, computation])),
    [computations]
  );

  return (
    <div className="flex flex-col gap-3">
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
              <TableHead>Warnings</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <SalesOrderLineRow
                key={field.id}
                index={index}
                productOptions={productOptions}
                computation={computationByLineNumber.get(index + 1)}
                customerId={customerId}
                orderDate={orderDate}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={() => append(BLANK_LINE)}>
        <Plus size={16} />
        Add Line
      </Button>
    </div>
  );
}
