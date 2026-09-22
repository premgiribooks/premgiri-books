"use client";

import type * as React from "react";

import { LoadingBar } from "@/components/common/loading-bar";

interface InfiniteScrollSentinelProps {
  hasMore: boolean;
  isLoading: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

/** Bottom-of-list marker for `useInfiniteList` — an invisible div the
 * IntersectionObserver watches, showing the shared loading indicator while
 * the next page is being fetched. Renders nothing once there's no more
 * data. */
export function InfiniteScrollSentinel({ hasMore, isLoading, sentinelRef }: InfiniteScrollSentinelProps) {
  if (!hasMore) {
    return null;
  }
  return (
    <div ref={sentinelRef} className="flex justify-center py-6">
      {isLoading ? <LoadingBar className="w-32" label="Loading more" /> : null}
    </div>
  );
}
