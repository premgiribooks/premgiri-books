"use client";

import { useBreadcrumbLabel } from "@/hooks/use-breadcrumb-label";

interface BreadcrumbLabelSetterProps {
  /** The trail href this label applies to — e.g. `/masters/products/{id}`. */
  href: string;
  label: string;
}

/**
 * Lets a Server Component page register a dynamic breadcrumb label (e.g. an
 * entity's name) for its own id segment, without `BreadcrumbBar` itself
 * fetching anything (56-product-detail-page.md's "dynamic product-name
 * breadcrumb segment"). Renders nothing — a pure registration side effect.
 */
export function BreadcrumbLabelSetter({ href, label }: BreadcrumbLabelSetterProps) {
  useBreadcrumbLabel(href, label);
  return null;
}
