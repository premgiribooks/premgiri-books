import { NextResponse, type NextRequest } from "next/server";

import { toActionErrorMessage } from "@/lib/action-error";
import { globalSearchService } from "@/modules/search/services/global-search-service";
import type { ActionResult } from "@/types/api";
import type { GlobalSearchGroup } from "@/types/global-search";

/**
 * 75-global-search.md's transport for the Command Palette's DATA tier. A
 * Route Handler, not a Server Action: per this Next.js version's own docs
 * ("Backend for Frontend" guide, Caveats > Server Actions), "Server Actions
 * are queued. Using them for data fetching introduces sequential
 * execution" — exactly wrong for a search-as-you-type call fired on every
 * keystroke, and invoking one from the client also triggers a full refresh
 * of the current route's Server Components (this was the prior
 * `globalSearchAction` implementation's real cost, not `globalSearchService`
 * itself — a live session showed every call wrapped in a multi-second
 * whole-page POST). A `fetch()`-based Route Handler avoids both: no
 * queuing, no page re-render, and the client can `AbortController.abort()`
 * a stale in-flight request when a newer keystroke supersedes it.
 */
export async function GET(request: NextRequest): Promise<NextResponse<ActionResult<GlobalSearchGroup[]>>> {
  const query = request.nextUrl.searchParams.get("q") ?? "";

  try {
    const data = await globalSearchService.search(query);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: toActionErrorMessage(error) }, { status: 500 });
  }
}
