"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { openingStockService } from "@/modules/opening-stock/services/opening-stock-service";
import type { RecordOpeningStockInput } from "@/modules/opening-stock/validation/opening-stock-schema";
import type { RecordedStockTransaction } from "@/engines/inventory/types";
import type { ActionResult } from "@/types/api";
import type { OpeningStockListFilters, OpeningStockListRow } from "@/types/opening-stock";

const LIST_PATH = "/inventory/opening-stock";

/** Infinite-scroll "load more" for the Opening Stock list — a pure read, so
 * no paths are revalidated. */
export async function loadMoreOpeningStockEntriesAction(
  filters: OpeningStockListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<OpeningStockListRow>>> {
  return runAction(() => openingStockService.listOpeningStockEntriesPage(filters, { skip, take }), []);
}

export async function recordOpeningStockAction(input: RecordOpeningStockInput): Promise<ActionResult<RecordedStockTransaction[]>> {
  return runAction(() => openingStockService.recordOpeningStock(input), [LIST_PATH]);
}
