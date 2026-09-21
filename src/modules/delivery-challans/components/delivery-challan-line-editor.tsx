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
import { DeliveryChallanLineRow } from "@/modules/delivery-challans/components/delivery-challan-line-row";
import type { CreateDeliveryChallanInput } from "@/modules/delivery-challans/validation/delivery-challan-schema";
import type {
  DeliveryChallanProductOption,
  OpenSalesOrderLineOption,
} from "@/types/delivery-challan";

const BLANK_LINE = { productId: "" as unknown as string, quantity: 1 };

function optionLabel(product: DeliveryChallanProductOption): string {
  const base = product.productCode ? `${product.name} (${product.productCode})` : product.name;
  return product.isActive ? base : `${base} (Inactive)`;
}

interface DeliveryChallanLineEditorProps {
  products: DeliveryChallanProductOption[];
  /** When set, every row is locked to one of the linked Sales Order's
   * remaining lines — product fixed, no Add Line button (a challan linked
   * to an order can only deliver against that order's own lines, per
   * 37-delivery-challans.md's Data Model). */
  linkedLines?: OpenSalesOrderLineOption[];
}

/** The Delivery Challan Form's line-item editor — no pricing/tax columns,
 * unlike sales-order-line-editor.tsx/quotation-line-editor.tsx (this
 * document records quantity only — no warehouse picker either, removed per
 * explicit user request, 2026-09-20: this document never moves real stock,
 * and which warehouse(s) actually fulfil the eventual sale is resolved
 * automatically at Sales Invoice posting time). */
export function DeliveryChallanLineEditor({ products, linkedLines }: DeliveryChallanLineEditorProps) {
  const { control } = useFormContext<CreateDeliveryChallanInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const productOptions: ProductOptionItem[] = React.useMemo(
    () => products.map((product) => ({ id: product.id, label: optionLabel(product), isActive: product.isActive })),
    [products]
  );

  const linkedLineByIndex = linkedLines;
  const isLinked = linkedLineByIndex !== undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <DeliveryChallanLineRow
                key={field.id}
                index={index}
                productOptions={productOptions}
                linkedLine={linkedLineByIndex?.[index]}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {!isLinked ? (
        <Button type="button" variant="outline" size="sm" onClick={() => append(BLANK_LINE)}>
          <Plus size={16} />
          Add Line
        </Button>
      ) : null}
    </div>
  );
}
