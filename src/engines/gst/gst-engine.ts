import { calculateDocument, calculateLine, determineSupplyType, isHsnRequired } from "@/engines/gst/gst-calculation";
import { getInwardSupplyLines, getOutwardSupplyLines } from "@/engines/gst/gst-report-queries";

export { calculateDocument, calculateLine, determineSupplyType, isHsnRequired };
export { getGstStateName, GST_STATE_CODES, isValidGstStateCode, type GstStateCode } from "@/engines/gst/state-codes";
export { getInwardSupplyLines, getOutwardSupplyLines };
export {
  GST_SUPPLY_LINE_DOCUMENT_TYPES,
  type GstSupplyLine,
  type GstSupplyLineDocumentType,
} from "@/engines/gst/gst-report-types";
export type {
  CalculateDocumentInput,
  CalculateDocumentResult,
  CalculateLineInput,
  CalculateLineResult,
  DocumentGroupResult,
  SupplyType,
} from "@/engines/gst/types";

/** Public API surface for every future taxed document (Sales/Purchase Invoice, Credit/Debit Notes, returns) — 33-gst-engine.md. */
export const gstEngine = {
  determineSupplyType,
  calculateLine,
  calculateDocument,
  isHsnRequired,
};

/** Public API surface for GST reports (57-gst-registers.md) — pure read-only aggregation, no permission check; callers gate. */
export const gstReportEngine = {
  getOutwardSupplyLines,
  getInwardSupplyLines,
};
