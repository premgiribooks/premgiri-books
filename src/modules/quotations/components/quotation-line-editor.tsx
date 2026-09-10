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
import { QuotationLineRow } from "@/modules/quotations/components/quotation-line-row";
import type { CreateQuotationInput } from "@/modules/quotations/validation/quotation-schema";
import type { QuotationLineComputation, QuotationProductOption } from "@/types/quotation";

const BLANK_LINE = {
  productId: "" as unknown as string,
  quantity: 1,
  rate: 0,
  discountPercent: undefined,
  discountAmount: undefined,
};

function productLabel(product: QuotationProductOption): string {
  const base = `${product.name} (${product.productCode})`;
  return product.isActive ? base : `${base} (Inactive)`;
}

interface QuotationLineEditorProps {
  products: QuotationProductOption[];
  computations: QuotationLineComputation[];
  customerId: string | undefined;
  quotationDate: string;
}

/**
 * The Quotation Form's line-item editor — a single `useFieldArray` bound to
 * the parent form's `lines`, saved in one submit with the header (unlike
 * price-list-items-editor.tsx's per-row Server Actions; a quotation's
 * header+lines are written atomically, 35-quotations.md's Service section).
 * Every computed cell comes from `computations` (the debounced
 * previewQuotationAction result the parent form owns) — this component
 * never calculates tax or pricing itself.
 */
export function QuotationLineEditor({
  products,
  computations,
  customerId,
  quotationDate,
}: QuotationLineEditorProps) {
  const { control } = useFormContext<CreateQuotationInput>();
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
              <QuotationLineRow
                key={field.id}
                index={index}
                productOptions={productOptions}
                computation={computationByLineNumber.get(index + 1)}
                customerId={customerId}
                quotationDate={quotationDate}
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
