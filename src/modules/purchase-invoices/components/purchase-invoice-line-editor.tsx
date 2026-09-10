"use client";

import * as React from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProductOptionItem } from "@/modules/products/components/product-option-selector";
import { PurchaseInvoiceLineRow } from "@/modules/purchase-invoices/components/purchase-invoice-line-row";
import type { CreatePurchaseInvoiceInput } from "@/modules/purchase-invoices/validation/purchase-invoice-schema";
import type {
  PurchaseInvoiceLineComputation,
  PurchaseInvoiceProductOption,
  PurchaseInvoiceWarehouseOption,
} from "@/types/purchase-invoice";

const BLANK_LINE = {
  productId: "" as unknown as string,
  warehouseId: "" as unknown as string,
  quantity: 1,
  rate: 0,
  discountPercent: undefined,
  discountAmount: undefined,
  isTaxOverridden: false,
};

function productLabel(product: PurchaseInvoiceProductOption): string {
  const base = `${product.name} (${product.productCode})`;
  return product.isActive ? base : `${base} (Inactive)`;
}

function warehouseLabel(warehouse: PurchaseInvoiceWarehouseOption): string {
  return `${warehouse.name} (${warehouse.code})`;
}

interface PurchaseInvoiceLineEditorProps {
  products: PurchaseInvoiceProductOption[];
  warehouses: PurchaseInvoiceWarehouseOption[];
  computations: PurchaseInvoiceLineComputation[];
  isIntraState: boolean;
  /** True when reached from a Goods Receipt Note prefill — locks
   * product/warehouse/qty and disables Add/Remove (mirrors
   * sales-invoice-line-editor.tsx's `locked` prop). */
  locked?: boolean;
}

/** Mirrors sales-invoice-line-editor.tsx, minus the pricing-engine round
 * trip (purchase-order-line-row.tsx's `purchasePrice` prefill instead). Not
 * extracted into a shared DocumentLineEditor for the same YAGNI reasoning
 * recorded across this codebase's other line-editor file comments. */
export function PurchaseInvoiceLineEditor({
  products,
  warehouses,
  computations,
  isIntraState,
  locked,
}: PurchaseInvoiceLineEditorProps) {
  const { control } = useFormContext<CreatePurchaseInvoiceInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });

  const productOptions: ProductOptionItem[] = React.useMemo(
    () => products.map((product) => ({ id: product.id, label: productLabel(product), isActive: product.isActive })),
    [products]
  );
  const warehouseOptions: ProductOptionItem[] = React.useMemo(
    () => warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouseLabel(warehouse), isActive: warehouse.isActive })),
    [warehouses]
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
              <TableHead>Warehouse</TableHead>
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
              <PurchaseInvoiceLineRow
                key={field.id}
                index={index}
                productOptions={productOptions}
                warehouseOptions={warehouseOptions}
                productsById={productsById}
                computation={computationByLineNumber.get(index + 1)}
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
