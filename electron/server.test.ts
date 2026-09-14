import http from "node:http";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildServerEnv, resolveStandaloneServerEntry, waitForServerReady } from "./server";

describe("resolveStandaloneServerEntry", () => {
  it("resolves under resourcesPath when packaged", () => {
    const entry = resolveStandaloneServerEntry({
      isPackaged: true,
      resourcesPath: "/Applications/Premgiri Books ERP.app/Contents/Resources",
      projectRoot: "/unused",
    });

    expect(entry).toBe(
      path.join("/Applications/Premgiri Books ERP.app/Contents/Resources", "standalone", "server.js"),
    );
  });

  it("resolves under .next/standalone in the project root when not packaged", () => {
    const entry = resolveStandaloneServerEntry({
      isPackaged: false,
      resourcesPath: "/unused",
      projectRoot: "/repo",
    });

    expect(entry).toBe(path.join("/repo", ".next", "standalone", "server.js"));
  });
});

describe("buildServerEnv", () => {
  it("points PUPPETEER_CACHE_DIR at the bundled puppeteer-cache resource when packaged", () => {
    const env = buildServerEnv(
      { isPackaged: true, resourcesPath: "/Applications/Premgiri Books ERP.app/Contents/Resources", projectRoot: "/unused" },
      8903,
      "127.0.0.1",
    );

    expect(env.PUPPETEER_CACHE_DIR).toBe(
      path.join("/Applications/Premgiri Books ERP.app/Contents/Resources", "puppeteer-cache"),
    );
    expect(env.ELECTRON_RUN_AS_NODE).toBe("1");
    expect(env.PORT).toBe("8903");
  });

  it("leaves PUPPETEER_CACHE_DIR unset in dev — .puppeteerrc.cjs already resolves it there", () => {
    const previous = process.env.PUPPETEER_CACHE_DIR;
    delete process.env.PUPPETEER_CACHE_DIR;

    try {
      const env = buildServerEnv({ isPackaged: false, resourcesPath: "/unused", projectRoot: "/repo" }, 8903, "127.0.0.1");
      expect(env.PUPPETEER_CACHE_DIR).toBeUndefined();
    } finally {
      if (previous !== undefined) {
        process.env.PUPPETEER_CACHE_DIR = previous;
      }
    }
  });
});

describe("waitForServerReady", () => {
  it("resolves once the server starts accepting requests", async () => {
    const server = http.createServer((_req, res) => res.end("ok"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a bound TCP address");
    }

    await expect(
      waitForServerReady(`http://127.0.0.1:${address.port}`, { timeoutMs: 2000, intervalMs: 20 }),
    ).resolves.toBeUndefined();

    server.close();
  });

  it("rejects once the timeout elapses if nothing responds", async () => {
    await expect(
      waitForServerReady("http://127.0.0.1:1", { timeoutMs: 200, intervalMs: 20 }),
    ).rejects.toThrow(/Timed out/);
  });
});
