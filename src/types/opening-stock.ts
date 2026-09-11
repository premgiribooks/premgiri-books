export type { RecordedStockTransaction } from "@/engines/inventory/types";

// Read-model shapes are owned by stock-transaction-repository.ts (mirrors
// src/engines/inventory/types.ts's identical re-export of
// StockMovementLineInput/TransferStockInput from inventory-validation.ts) —
// this file is the app-wide alias consumers actually import from.
export type {
  OpeningStockListFilters,
  OpeningStockListRow,
  OpeningStockProductOption,
  OpeningStockWarehouseOption,
} from "@/modules/stock-transactions/repositories/stock-transaction-repository";

import type {
  OpeningStockProductOption,
  OpeningStockWarehouseOption,
} from "@/modules/stock-transactions/repositories/stock-transaction-repository";

export interface OpeningStockFormOptions {
  products: OpeningStockProductOption[];
  warehouses: OpeningStockWarehouseOption[];
}
