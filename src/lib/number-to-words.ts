const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsToWords(value: number): string {
  if (value < 20) {
    return ONES[value];
  }
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return ones === 0 ? TENS[tens] : `${TENS[tens]} ${ONES[ones]}`;
}

function threeDigitsToWords(value: number): string {
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const parts: string[] = [];
  if (hundreds > 0) {
    parts.push(`${ONES[hundreds]} Hundred`);
  }
  if (remainder > 0) {
    parts.push(twoDigitsToWords(remainder));
  }
  return parts.join(" ");
}

/**
 * Converts a non-negative integer into words using the Indian numbering
 * system (Crore/Lakh/Thousand/Hundred grouping, not the Western
 * Million/Billion grouping) — the convention every printed Indian tax
 * invoice/GST document uses for its "Amount in Words" line.
 */
export function integerToIndianWords(value: number): string {
  if (value === 0) {
    return "Zero";
  }

  const crore = Math.floor(value / 10000000);
  const lakh = Math.floor((value % 10000000) / 100000);
  const thousand = Math.floor((value % 100000) / 1000);
  const hundred = value % 1000;

  const parts: string[] = [];
  if (crore > 0) {
    parts.push(`${threeDigitsToWords(crore)} Crore`);
  }
  if (lakh > 0) {
    parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  }
  if (thousand > 0) {
    parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  }
  if (hundred > 0) {
    parts.push(threeDigitsToWords(hundred));
  }
  return parts.join(" ");
}

/**
 * Formats a monetary amount as `"<currency> <amount in words> Only"` (with
 * an `"and <paise> Paise"` clause when a fractional part exists) — the
 * standard printed "Amount in Words" line on an Indian tax invoice. Negative
 * amounts are formatted using their absolute value (a grand total is never
 * negative in practice; this just avoids an unreadable "Minus" prefix if one
 * ever were).
 */
export function amountToWords(amount: number, currencyLabel = "Indian Rupee"): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  const rupeeWords = `${currencyLabel} ${integerToIndianWords(rupees)}`;
  if (paise === 0) {
    return `${rupeeWords} Only`;
  }
  return `${rupeeWords} and ${integerToIndianWords(paise)} Paise Only`;
}
