export type GlobalSearchGroupKey = "products" | "customers" | "suppliers" | "ledgers";

export interface GlobalSearchItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

/** One labeled section of the Global Search overlay's results (75-global-search.md).
 * `totalMatches` is the full match count before the `items` cap, so the UI can render
 * "See all N results in {groupLabel}" even though `items` itself never exceeds 5. */
export interface GlobalSearchGroup {
  groupKey: GlobalSearchGroupKey;
  groupLabel: string;
  items: GlobalSearchItem[];
  totalMatches: number;
}
