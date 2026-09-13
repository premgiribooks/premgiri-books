import http from "node:http";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveStandaloneServerEntry, waitForServerReady } from "./server";

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
