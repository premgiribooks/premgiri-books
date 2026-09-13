import net from "node:net";
import { describe, expect, it } from "vitest";

import { getAvailablePort, getFreePort } from "./get-free-port";

describe("getFreePort", () => {
  it("returns a valid, currently-free TCP port", async () => {
    const port = await getFreePort();

    expect(Number.isInteger(port)).toBe(true);
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);

    // Prove it is actually free right now, not just a plausible-looking number.
    await new Promise<void>((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => server.close(() => resolve()));
    });
  });

  it("returns a different port across concurrent calls", async () => {
    const [first, second] = await Promise.all([getFreePort(), getFreePort()]);

    expect(first).not.toBe(second);
  });
});

describe("getAvailablePort", () => {
  it("returns the preferred port when it is free", async () => {
    const preferred = await getFreePort();

    const port = await getAvailablePort(preferred);

    expect(port).toBe(preferred);
  });

  it("falls back to a different free port when the preferred one is taken", async () => {
    const preferred = await getFreePort();
    const blocker = net.createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(preferred, "127.0.0.1", () => resolve());
    });

    try {
      const port = await getAvailablePort(preferred);
      expect(port).not.toBe(preferred);
      expect(Number.isInteger(port)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });
});
