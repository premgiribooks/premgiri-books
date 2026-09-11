"use server";

import { runAction } from "@/lib/run-action";
import { openingStockService } from "@/modules/opening-stock/services/opening-stock-service";
import type { RecordOpeningStockInput } from "@/modules/opening-stock/validation/opening-stock-schema";
import type { RecordedStockTransaction } from "@/engines/inventory/types";
import type { ActionResult } from "@/types/api";

const LIST_PATH = "/inventory/opening-stock";

export async function recordOpeningStockAction(input: RecordOpeningStockInput): Promise<ActionResult<RecordedStockTransaction[]>> {
  return runAction(() => openingStockService.recordOpeningStock(input), [LIST_PATH]);
}
