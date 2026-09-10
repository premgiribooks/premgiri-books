import type {
  GoodsReceiptNote as PrismaGoodsReceiptNote,
  GoodsReceiptNoteItem as PrismaGoodsReceiptNoteItem,
} from "@prisma/client";

export type { GoodsReceiptNoteStatus } from "@prisma/client";

// Decimal -> number normalization at the repository boundary — the
// src/types/delivery-challan.ts convention, extended here identically. Both
// `quantity` and `rejectedQuantity` are Decimal on this document
// (43-goods-receipt-note.md: "No pricing or GST fields on this document").
export interface GoodsReceiptNoteItem extends Omit<PrismaGoodsReceiptNoteItem, "quantity" | "rejectedQuantity"> {
  quantity: number;
  rejectedQuantity: number;
}

export type GoodsReceiptNote = PrismaGoodsReceiptNote;

/** The slice of Product a GRN line's read-model needs to display — mirrors
 * DeliveryChallanProductSnapshot. */
export interface GoodsReceiptNoteProductSnapshot {
  id: string;
  name: string;
  productCode: string;
  isActive: boolean;
}

/** The slice of Warehouse a GRN line's read-model needs. */
export interface GoodsReceiptNoteWarehouseSnapshot {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface GoodsReceiptNoteItemDetail extends GoodsReceiptNoteItem {
  product: GoodsReceiptNoteProductSnapshot;
  warehouse: GoodsReceiptNoteWarehouseSnapshot;
}

/** The slice of Supplier a GRN's read-model needs — mirrors
 * DeliveryChallanCustomerOption. */
export interface GoodsReceiptNoteSupplierOption {
  id: string;
  name: string;
  isActive: boolean;
}

/** The slice of the linked Purchase Order a GRN's read-model needs for
 * display (list "Linked Order" column, detail header). */
export interface GoodsReceiptNotePurchaseOrderSnapshot {
  id: string;
  orderNumber: string;
}

export interface GoodsReceiptNoteListRow extends GoodsReceiptNote {
  supplier: GoodsReceiptNoteSupplierOption;
  purchaseOrder: GoodsReceiptNotePurchaseOrderSnapshot | null;
  lineCount: number;
}

export interface GoodsReceiptNoteDetail extends GoodsReceiptNote {
  supplier: GoodsReceiptNoteSupplierOption;
  purchaseOrder: GoodsReceiptNotePurchaseOrderSnapshot | null;
  items: GoodsReceiptNoteItemDetail[];
}

export type GoodsReceiptNoteStatusFilter = "DRAFT" | "RECEIVED" | "INVOICED" | "CANCELLED";

export interface GoodsReceiptNoteListFilters {
  search?: string;
  status?: GoodsReceiptNoteStatusFilter;
  supplierId?: string;
  fromDate?: Date;
  toDate?: Date;
}

/** The product picker's options — no pricing/GST columns needed, unlike
 * PurchaseOrderProductOption (this document records quantity, rejected
 * quantity, and warehouse only). */
export interface GoodsReceiptNoteProductOption {
  id: string;
  name: string;
  productCode: string;
  isActive: boolean;
  unitSymbol: string;
  unitDecimalPlaces: number;
}

/** The warehouse picker's options. */
export interface GoodsReceiptNoteWarehouseOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

/** Everything the GRN Form needs to render its pickers and the "next
 * number" preview, loaded once up front — mirrors DeliveryChallanFormOptions. */
export interface GoodsReceiptNoteFormOptions {
  suppliers: GoodsReceiptNoteSupplierOption[];
  products: GoodsReceiptNoteProductOption[];
  warehouses: GoodsReceiptNoteWarehouseOption[];
  nextGrnNumber: string;
}

/**
 * One remaining (unreceived) line of an open Purchase Order — the shape the
 * "New Goods Receipt Note" page pre-fills its lines from when navigated with
 * `?purchaseOrderId=`. Read-only lookup data, not a persisted entity; see
 * goods-receipt-note-service.ts's file comment for why this replaces a
 * dedicated `createFromPurchaseOrder` persist method.
 */
export interface OpenPurchaseOrderLineOption {
  purchaseOrderItemId: string;
  productId: string;
  productName: string;
  productCode: string;
  unitSymbol: string;
  unitDecimalPlaces: number;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
}

/** The prefill payload for "New Goods Receipt Note" when reached from a
 * Purchase Order's "Create Goods Receipt Note" action. */
export interface PurchaseOrderPrefill {
  purchaseOrderId: string;
  orderNumber: string;
  supplierId: string;
  lines: OpenPurchaseOrderLineOption[];
}
