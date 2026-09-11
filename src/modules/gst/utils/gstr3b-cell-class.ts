// Plain, server-safe helper — deliberately NOT in gstr3b-row-note.tsx, which
// is "use client" (it uses the Tooltip primitive). A "use client" module's
// exports are all opaque client references from a Server Component's
// perspective; a synchronous string-returning helper like this one must live
// in its own non-"use client" file to be callable directly from the
// server-rendered GSTR-3B table components.

/** Shared right-aligned financial cell class — muted for a not-computed row's always-₹0 figure, plain for a real computed one. */
export function gstr3bFinancialCellClass(computed: boolean): string {
  return computed ? "text-right font-financial" : "text-right font-financial text-muted-foreground";
}
