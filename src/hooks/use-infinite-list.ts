"use client";

import * as React from "react";
import { toast } from "sonner";

import { DEFAULT_LOAD_MORE_SIZE, type Page } from "@/lib/pagination";
import type { ActionResult } from "@/types/api";

interface UseInfiniteListOptions<T> {
  initialItems: T[];
  initialHasMore: boolean;
  /** A Server Action (typically `someLoadMoreAction.bind(null, filters)`)
   * returning the next page starting at `skip`. Omit to render a plain,
   * non-paginated list (`hasMore` is then always treated as false). */
  loadMore?: (skip: number, take: number) => Promise<ActionResult<Page<T>>>;
  pageSize?: number;
}

interface UseInfiniteListResult<T> {
  items: T[];
  hasMore: boolean;
  isLoading: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Infinite-scroll state/fetch logic for a list/table component. Lives
 * entirely inside the (already "use client") table component that calls
 * it — deliberately NOT a wrapper component that clones a passed-in
 * element: an element crossing the Server->Client boundary as `children`
 * and then mutated via `React.cloneElement` on the client turned out to
 * corrupt its type (see git history — "Element type is invalid" at
 * runtime, only in the browser, despite clean `tsc`/SSR). Passing plain
 * props (`initialItems`, `initialHasMore`, a bound Server Action) into a
 * Client Component is fully supported; cloning a foreign element is not.
 *
 * Give the calling component's own instance a `key` derived from the
 * page's filters (e.g. `key={JSON.stringify(filters)}` on `<XTable>` in
 * the page.tsx) so a filter change remounts it with a fresh
 * `initialItems`/`initialHasMore` instead of appending onto stale state.
 */
export function useInfiniteList<T>({
  initialItems,
  initialHasMore,
  loadMore,
  pageSize = DEFAULT_LOAD_MORE_SIZE,
}: UseInfiniteListOptions<T>): UseInfiniteListResult<T> {
  const [items, setItems] = React.useState(initialItems);
  const [hasMore, setHasMore] = React.useState(initialHasMore && Boolean(loadMore));
  const [isLoading, setIsLoading] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const isLoadingRef = React.useRef(false);

  const fetchNext = React.useCallback(async () => {
    if (!loadMore || isLoadingRef.current || !hasMore) {
      return;
    }
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const result = await loadMore(items.length, pageSize);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Failed to load more.");
        return;
      }
      const nextPage = result.data;
      setItems((prev) => [...prev, ...nextPage.items]);
      setHasMore(nextPage.hasMore);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [hasMore, items.length, loadMore, pageSize]);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNext();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, fetchNext]);

  return { items, hasMore, isLoading, sentinelRef };
}
