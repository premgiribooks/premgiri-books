// GSTR-1 offline-tool import workbook (GSTR1_Excel_Workbook_Template_V2.2) —
// the portal's own drop-down "master" lists. The offline tool rejects any value
// that is not spelled exactly like these, so they are copied verbatim from the
// template's `master` sheet and are NOT derived from state-codes.ts (whose
// display names differ from the portal's spelling).

import { AppError } from "@/lib/app-error";

/** Place-of-supply drop-down (template `POS` list), keyed by 2-digit GST state code. */
const PORTAL_POS_LABELS: Readonly<Record<string, string>> = {
  "01": "01-Jammu & Kashmir",
  "02": "02-Himachal Pradesh",
  "03": "03-Punjab",
  "04": "04-Chandigarh",
  "05": "05-Uttarakhand",
  "06": "06-Haryana",
  "07": "07-Delhi",
  "08": "08-Rajasthan",
  "09": "09-Uttar Pradesh",
  "10": "10-Bihar",
  "11": "11-Sikkim",
  "12": "12-Arunachal Pradesh",
  "13": "13-Nagaland",
  "14": "14-Manipur",
  "15": "15-Mizoram",
  "16": "16-Tripura",
  "17": "17-Meghalaya",
  "18": "18-Assam",
  "19": "19-West Bengal",
  "20": "20-Jharkhand",
  "21": "21-Odisha",
  "22": "22-Chhattisgarh",
  "23": "23-Madhya Pradesh",
  "24": "24-Gujarat",
  "25": "25-Daman & Diu",
  "26": "26-Dadra & Nagar Haveli & Daman & Diu",
  "27": "27-Maharashtra",
  "29": "29-Karnataka",
  "30": "30-Goa",
  "31": "31-Lakshdweep",
  "32": "32-Kerala",
  "33": "33-Tamil Nadu",
  "34": "34-Puducherry",
  "35": "35-Andaman & Nicobar Islands",
  "36": "36-Telangana",
  "37": "37-Andhra Pradesh",
  "38": "38-Ladakh",
  "97": "97-Other Territory",
};

/** Combined (CGST+SGST) / IGST rates accepted by the template's `RATE` list. */
const PORTAL_RATES: readonly number[] = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40];

/** Template `NUQC` list (the HSN sheets' UQC drop-down). */
const PORTAL_UQC_LABELS: readonly string[] = [
  "BAG-BAGS",
  "BAL-BALE",
  "BDL-BUNDLES",
  "BKL-BUCKLES",
  "BOU-BILLION OF UNITS",
  "BOX-BOX",
  "BTL-BOTTLES",
  "BUN-BUNCHES",
  "CAN-CANS",
  "CBM-CUBIC METERS",
  "CCM-CUBIC CENTIMETERS",
  "CMS-CENTIMETERS",
  "CTN-CARTONS",
  "DOZ-DOZENS",
  "DRM-DRUMS",
  "GGK-GREAT GROSS",
  "GMS-GRAMMES",
  "GRS-GROSS",
  "GYD-GROSS YARDS",
  "KGS-KILOGRAMS",
  "KLR-KILOLITRE",
  "KME-KILOMETRE",
  "LTR-LITRES",
  "MLT-MILILITRE",
  "MTR-METERS",
  "MTS-METRIC TON",
  "NOS-NUMBERS",
  "PAC-PACKS",
  "PCS-PIECES",
  "PRS-PAIRS",
  "QTL-QUINTAL",
  "ROL-ROLLS",
  "SET-SETS",
  "SQF-SQUARE FEET",
  "SQM-SQUARE METERS",
  "SQY-SQUARE YARDS",
  "TBS-TABLETS",
  "TGM-TEN GROSS",
  "THD-THOUSANDS",
  "TON-TONNES",
  "TUB-TUBES",
  "UGS-US GALLONS",
  "UNT-UNITS",
  "YDS-YARDS",
  "OTH-OTHERS",
];

/** Used when a unit's own code is not one of the portal's UQC codes. */
const FALLBACK_UQC_LABEL = "OTH-OTHERS";

const UQC_LABEL_BY_CODE: ReadonlyMap<string, string> = new Map(
  PORTAL_UQC_LABELS.map((label) => [label.slice(0, label.indexOf("-")), label])
);

/** Template `DOCUMENT` list entries the docs sheet uses (Table 13). */
export const DOCUMENT_NATURE = {
  INVOICE: "Invoices for outward supply",
  CREDIT_NOTE: "Credit Note",
  DEBIT_NOTE: "Debit Note",
} as const;

export type DocumentNature = (typeof DOCUMENT_NATURE)[keyof typeof DOCUMENT_NATURE];

/** Throws an `AppError` for a state code the portal has no drop-down entry for. */
export function toPosLabel(stateCode: string): string {
  const label = PORTAL_POS_LABELS[stateCode];
  if (!label) {
    throw new AppError(`Place of supply "${stateCode}" is not a state the GST portal accepts. Correct the document before exporting.`);
  }
  return label;
}

/**
 * Maps a unit's UQC code (or, failing that, its symbol) to the portal's
 * `CODE-DESCRIPTION` label. Anything the portal does not list becomes OTH-OTHERS.
 */
export function toUqcLabel(unitCode: string | null | undefined): string {
  const code = (unitCode ?? "").trim().toUpperCase();
  return UQC_LABEL_BY_CODE.get(code) ?? FALLBACK_UQC_LABEL;
}

/** Throws an `AppError` for a GST rate the portal's rate drop-down does not accept. */
export function assertPortalRate(ratePercent: number): number {
  if (!PORTAL_RATES.includes(ratePercent)) {
    throw new AppError(
      `GST rate ${ratePercent}% is not accepted by the GST portal (allowed: ${PORTAL_RATES.join(", ")}). Correct the document before exporting.`
    );
  }
  return ratePercent;
}
