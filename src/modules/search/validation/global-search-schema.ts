import { z } from "zod";

// 1-100 chars, trimmed — an empty/whitespace-only query fails `.min(1)` so
// `globalSearchService.search` can reject it before any fan-out call fires
// (75-global-search.md's Validation section), never trusting the client's
// own debounce/empty-input skip alone.
export const globalSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(100),
});

export type GlobalSearchQueryInput = z.infer<typeof globalSearchQuerySchema>;
