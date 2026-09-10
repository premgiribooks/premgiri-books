import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Width for a numeric input or read-only value cell that grows with its
 * content instead of clipping it, floored at `minDigits` characters so short
 * values don't leave the column looking arbitrarily cramped. `ch` sizes off
 * the "0" glyph — the natural unit for a numeric column — plus a couple of
 * characters of breathing room for the cursor/decimal point.
 */
export function numericFieldWidth(value: unknown, minDigits = 5): string {
  const text = value === null || value === undefined || value === "" ? "" : String(value)
  const length = Math.max(text.length, minDigits)
  return `${length + 2}ch`
}
