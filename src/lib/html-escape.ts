const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes a value for safe interpolation into a server-rendered HTML
 * string (78-pdf-generation.md's `build*Html` templates) — every field
 * ultimately comes from user-entered data (customer name, narration,
 * product name), so it must never be interpolated raw. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}
