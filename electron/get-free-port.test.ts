import net from "node:net";
import { describe, expect, it } from "vitest";

import { getFreePort } from "./get-free-port";

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
