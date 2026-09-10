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
import { PurchaseOrderLineRow } from "@/modules/purchase-orders/components/purchase-order-line-row";
import type { CreatePurchaseOrderInput } from "@/modules/purchase-orders/validation/purchase-order-schema";
import type { PurchaseOrderLineComputation, PurchaseOrderProductOption } from "@/types/purchase-order";

const BLANK_LINE = {
  productId: "" as unknown as string,
  quantity: 1,
  rate: 0,
  discountPercent: undefined,
  discountAmount: undefined,
};

function productLabel(product: PurchaseOrderProductOption): string {
  const base = `${product.name} (${product.productCode})`;
  return product.isActive ? base : `${base} (Inactive)`;
}

interface PurchaseOrderLineEditorProps {
  products: PurchaseOrderProductOption[];
  computations: PurchaseOrderLineComputation[];
}

/**
 * The Purchase Order Form's line-item editor — mirrors
 * sales-order-line-editor.tsx exactly, minus the customer/orderDate props
 * that only existed there to feed a price-resolution call this spec never
 * makes.
 *
 * Not extracted into a shared `DocumentLineEditor`, per 42-purchase-orders.md
 * deferring to 36-sales-orders.md's own recorded YAGNI decision on this
 * point — the abstraction remains deferred until a third document actually
 * needs it.
 */
export function PurchaseOrderLineEditor({ products, computations }: PurchaseOrderLineEditorProps) {
  const { control } = useFormContext<CreatePurchaseOrderInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

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
              <PurchaseOrderLineRow
                key={field.id}
                index={index}
                productOptions={productOptions}
                productsById={productsById}
                computation={computationByLineNumber.get(index + 1)}
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
