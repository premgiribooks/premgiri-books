import type * as React from "react";

import { cn } from "@/lib/utils";

interface LoadingBarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height"> {
  label?: string;
}

/**
 * The app-wide loading indicator (public/screen-laoder.svg) — an animated
 * progress bar used for every page-level and in-component data load or
 * pending-action state. Plain <img>, not next/image: the SVG's own <style>
 * animation needs to render as-authored, and Next's image optimizer has
 * nothing to offer a vector asset already sized in the file itself. Extra
 * props (e.g. `data-icon="inline-start"`) pass through so it can drop into
 * a Button's icon slot exactly like a lucide icon would.
 */
export function LoadingBar({ className, label = "Loading", ...props }: LoadingBarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- animated SVG asset, not a photo to optimize
    <img
      src="/screen-laoder.svg"
      alt={label}
      width={260}
      height={24}
      className={cn("h-auto w-16 shrink-0", className)}
      {...props}
    />
  );
}
