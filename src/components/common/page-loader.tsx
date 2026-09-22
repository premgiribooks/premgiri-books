import { LoadingBar } from "@/components/common/loading-bar";

/**
 * Full-page loading state — rendered by app/loading.tsx while a route's
 * Server Components are fetching data, and reusable anywhere else a whole
 * content area (not just one control) is waiting on data.
 */
export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] w-full flex-1 items-center justify-center">
      <LoadingBar className="w-64" label="Loading page" />
    </div>
  );
}
