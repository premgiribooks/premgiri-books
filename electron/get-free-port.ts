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
