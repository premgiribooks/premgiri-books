import puppeteer, { type Browser } from "puppeteer";

/** `ui-context.md`'s paper-size convention — reports default `A4` portrait,
 * documents default `A5` (see each caller's own template). */
export interface PdfMargin {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

export interface PdfOptions {
  format: "A4" | "A5";
  orientation?: "portrait" | "landscape";
  margin?: PdfMargin;
  /** Optional running header/footer (e.g. "page N of M"). */
  headerHtml?: string;
  footerHtml?: string;
}

const DEFAULT_MARGIN: PdfMargin = { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" };

// A single headless Chromium instance is launched lazily on first use and
// reused across requests within this server process — Chromium cold-start
// cost (~200-500ms) would otherwise threaten code-standards.md's "Report
// Generation < 5 seconds" target on every single export (78-pdf-generation.md).
// Closed only on process shutdown (or explicitly via closePdfBrowser, for
// tests). A page (tab), not the browser itself, is opened/closed per render
// call so concurrent PDF requests never share mutable page state.
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({ headless: true });
  }
  return browserPromise;
}

/**
 * Turns a self-contained HTML string (every asset already inlined/base64 —
 * no external resource is fetched) into a paginated PDF buffer. No
 * permission check, no companyId, no Prisma import, no business logic of
 * any kind — every caller re-checks its own permission before invoking this
 * (78-pdf-generation.md's shared-core contract).
 */
export async function renderHtmlToPdf(html: string, options: PdfOptions): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Every template embeds its own inline/base64 assets — no external
    // resource is ever fetched — so "load" is sufficient; puppeteer's
    // setContent() doesn't accept the network-idle events goto() does.
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: options.format,
      landscape: options.orientation === "landscape",
      margin: options.margin ?? DEFAULT_MARGIN,
      printBackground: true,
      displayHeaderFooter: Boolean(options.headerHtml ?? options.footerHtml),
      headerTemplate: options.headerHtml ?? "",
      footerTemplate: options.footerHtml ?? "",
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/** Closes the shared browser instance, if one was launched. Only needed for
 * tests and graceful process shutdown — normal request handling never calls
 * this. */
export async function closePdfBrowser(): Promise<void> {
  if (!browserPromise) {
    return;
  }
  const browser = await browserPromise;
  await browser.close();
  browserPromise = null;
}
