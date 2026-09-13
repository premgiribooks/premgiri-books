import net from "node:net";

/**
 * Asks the OS for an ephemeral port by binding to port 0, then releasing it.
 * Used to pick a local port for the bundled Next.js standalone server so it
 * never collides with another instance or an unrelated local service.
 */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      reject(error);
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Could not determine a free port"));
        return;
      }

      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
        } else {
          resolve(port);
        }
      });
    });
  });
}

/**
 * Tries to bind the app's configured port first (see DEFAULT_SERVER_PORT in
 * server.ts) so the local server listens on a predictable address across
 * launches. Falls back to any free port if that one is already taken (e.g.
 * another instance of the app, or an unrelated local service already using
 * it) rather than failing to start at all.
 */
export function getAvailablePort(preferredPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", () => {
      getFreePort().then(resolve, reject);
    });

    server.listen(preferredPort, "127.0.0.1", () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
        } else {
          resolve(preferredPort);
        }
      });
    });
  });
}
