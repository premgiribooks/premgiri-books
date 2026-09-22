export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_LOAD_MORE_SIZE = 20;

export interface PageParams {
  skip: number;
  take: number;
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
}

/**
 * Runs a caller-supplied Prisma `findMany` (or equivalent) requesting one
 * extra row beyond `page.take`, so `hasMore` is known without a separate
 * COUNT query — the standard "request N+1" offset-pagination trick. Used by
 * every module's `findManyPage` repository method for infinite-scroll list
 * pages; the existing unpaginated `findMany` stays untouched for callers
 * that genuinely need every row (selectors/pickers).
 */
export async function fetchPage<T>(
  findMany: (args: { skip: number; take: number }) => Promise<T[]>,
  page: PageParams
): Promise<Page<T>> {
  const rows = await findMany({ skip: page.skip, take: page.take + 1 });
  return { items: rows.slice(0, page.take), hasMore: rows.length > page.take };
}
