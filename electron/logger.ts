import pino from "pino";
import path from "node:path";

export type Logger = pino.Logger;

/**
 * Mirrors src/lib/logger.ts's redaction policy for the main process. Writes
 * to a file under Electron's userData dir (rather than stdout) since a
 * packaged desktop app has no terminal attached to read logs from.
 */
export function createElectronLogger(userDataDir: string): Logger {
  const logFile = path.join(userDataDir, "logs", "main.log");

  return pino(
    {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      redact: {
        paths: ["password", "passwordHash", "token", "sessionToken"],
        censor: "[REDACTED]",
      },
    },
    pino.destination({ dest: logFile, mkdir: true, sync: false }),
  );
}
