import { afterAll, describe, expect, it, vi } from "vitest";
import puppeteer from "puppeteer";

import { closePdfBrowser, renderHtmlToPdf } from "@/lib/pdf-generation";

const MINIMAL_HTML = "<html><body><h1>Test Document</h1></body></html>";

describe("renderHtmlToPdf", () => {
  afterAll(async () => {
    await closePdfBrowser();
  });

  it(
    "produces a valid, non-empty PDF buffer for A4",
    async () => {
      const buffer = await renderHtmlToPdf(MINIMAL_HTML, { format: "A4" });

      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
    20000
  );

  it(
    "produces a valid, non-empty PDF buffer for A5",
    async () => {
      const buffer = await renderHtmlToPdf(MINIMAL_HTML, { format: "A5" });

      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
    20000
  );

  // Coarse regression guard on the lifecycle decision (78-pdf-generation.md):
  // a single Puppeteer instance is launched lazily and reused across
  // sequential renders, not relaunched per call.
  it(
    "reuses the same browser instance across sequential render calls",
    async () => {
      const launchSpy = vi.spyOn(puppeteer, "launch");

      await renderHtmlToPdf(MINIMAL_HTML, { format: "A4" });
      await renderHtmlToPdf(MINIMAL_HTML, { format: "A4" });

      expect(launchSpy).not.toHaveBeenCalled();
      launchSpy.mockRestore();
    },
    20000
  );
});
