import Link from "next/link";

import { Button } from "@/components/ui/button";

interface GstRegisterPaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  /** The current query string (date range, type, filters) minus `page` — this component sets `page` itself. */
  queryString: string;
}

function hrefForPage(page: number, queryString: string): string {
  const params = new URLSearchParams(queryString);
  params.set("page", String(page));
  return `/gst/registers?${params.toString()}`;
}

/** Previous/Next paging controls over gstRegisterService's already-computed page/pageSize/totalCount. */
export function GstRegisterPagination({ page, pageSize, totalCount, queryString }: GstRegisterPaginationProps) {
  if (totalCount === 0) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Showing {rangeStart}–{rangeEnd} of {totalCount}
      </p>
      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={hrefForPage(page - 1, queryString)}>Previous</Link>}
          />
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        {hasNext ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={hrefForPage(page + 1, queryString)}>Next</Link>}
          />
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
