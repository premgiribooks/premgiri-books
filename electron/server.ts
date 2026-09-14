import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import type { Logger } from "./logger";
import { getAvailablePort } from "./get-free-port";

/**
 * The local server's preferred port. Kept fixed (rather than always picking
 * a fresh free port) so the app listens on a predictable local address
 * across launches; getAvailablePort still falls back to a free port if this
 * one is already taken.
 */
export const DEFAULT_SERVER_PORT = 8903;

export interface StandaloneServerLocation {
  isPackaged: boolean;
  /** Electron's `process.resourcesPath` (only meaningful when packaged). */
  resourcesPath: string;
  /** The project root in dev, i.e. the directory containing package.json. */
  projectRoot: string;
}

/**
 * electron-builder ships `.next/standalone` unpacked under `extraResources`
 * (see the `build.extraResources` entry in package.json) so it can be
 * spawned as a plain Node process, rather than read out of the app's asar
 * archive. In development the app runs against the repo's own build output.
 */
export function resolveStandaloneServerEntry(location: StandaloneServerLocation): string {
  return location.isPackaged
    ? path.join(location.resourcesPath, "standalone", "server.js")
    : path.join(location.projectRoot, ".next", "standalone", "server.js");
}

export interface WaitForServerReadyOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

/**
 * Polls the standalone server's root URL until it responds or the timeout
 * elapses. The server writes its listen log line asynchronously, so a fixed
 * "sleep N seconds" delay would be either flaky (too short) or slow to start
 * (too long) — polling adapts to actual startup time.
 */
export async function waitForServerReady(
  url: string,
  { timeoutMs = 15_000, intervalMs = 150 }: WaitForServerReadyOptions = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Server not accepting connections yet — retry until the deadline.
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for the local server at ${url} to become ready`);
}

export interface RunningServer {
  url: string;
  /**
   * Resolves only once the child process has actually exited (verified via
   * its "exit" event) — never fire-and-forget. The child is spawned via
   * `process.execPath` (see below), which is the packaged app's own .exe, so
   * while it's alive there are two processes sharing that exe's name/path.
   * NSIS's "is the app still running" check (used both by the installer
   * overwriting files on update and by electron-updater's silent
   * quitAndInstall) matches by process name — an un-awaited kill() races
   * against that check and is what previously caused the installer's
   * "cannot be closed" dialog. Escalates to SIGKILL if graceful shutdown
   * doesn't finish within STOP_TIMEOUT_MS (e.g. a slow Prisma pool drain).
   */
  stop: () => Promise<void>;
}

const STOP_TIMEOUT_MS = 5_000;

/**
 * The standalone server's own env, split out from startNextServer so the
 * packaged-vs-dev PUPPETEER_CACHE_DIR branch (78-pdf-generation.md's known
 * packaging gap) is unit-testable without actually spawning a process.
 * Puppeteer's downloaded Chromium (see `.puppeteerrc.cjs`) lives outside
 * `node_modules`, in `.cache/puppeteer`, so it is not swept up by Next's
 * output-file-tracing into `.next/standalone` the way a real dependency
 * would be — it is instead shipped as its own `extraResources` entry
 * (`package.json`'s `build.extraResources`, unpacked to
 * `<resourcesPath>/puppeteer-cache`) and only findable by the spawned
 * server process via this env var, which puppeteer.launch() reads at
 * runtime to resolve the Chromium executable. Unset in dev — the .puppeteerrc.cjs
 * config file (found via the project root cwd `next dev` already runs from)
 * already points at the same `.cache/puppeteer` directory there.
 */
export function buildServerEnv(
  location: StandaloneServerLocation,
  port: number,
  hostname: string,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // process.execPath is the Electron binary itself, not a system Node
    // install — without this, the "child process" is actually a second
    // full Electron app instance, which re-runs main.ts, which spawns
    // another server, which spawns another Electron instance, forking
    // uncontrollably. ELECTRON_RUN_AS_NODE makes Electron's own bundled
    // binary behave as plain Node for this one process, which is also
    // why the standalone server doesn't need a separate Node.js install
    // on the end user's machine.
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: hostname,
  };

  if (location.isPackaged) {
    env.PUPPETEER_CACHE_DIR = path.join(location.resourcesPath, "puppeteer-cache");
  }

  return env;
}

/**
 * Spawns the bundled Next.js standalone server as a child process on a free
 * local port and waits for it to accept requests before resolving.
 */
export async function startNextServer(
  location: StandaloneServerLocation,
  logger: Logger,
): Promise<RunningServer> {
  const entry = resolveStandaloneServerEntry(location);
  const port = await getAvailablePort(DEFAULT_SERVER_PORT);
  const hostname = "127.0.0.1";
  const url = `http://${hostname}:${port}`;

  const child: ChildProcess = spawn(process.execPath, [entry], {
    cwd: path.dirname(entry),
    env: buildServerEnv(location, port, hostname),
    stdio: ["ignore", "pipe", "pipe"],
  });

  let hasExited = false;

  child.stdout?.on("data", (chunk: Buffer) => logger.info(chunk.toString().trim()));
  child.stderr?.on("data", (chunk: Buffer) => logger.error(chunk.toString().trim()));
  child.on("exit", (code, signal) => {
    hasExited = true;
    logger.warn(`Local server process exited (code=${code ?? "null"}, signal=${signal ?? "null"})`);
  });

  const stop = (): Promise<void> => {
    if (hasExited) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const forceKill = setTimeout(() => child.kill("SIGKILL"), STOP_TIMEOUT_MS);
      child.once("exit", () => {
        clearTimeout(forceKill);
        resolve();
      });
      child.kill();
    });
  };

  try {
    await waitForServerReady(url);
  } catch (error) {
    stop();
    throw error;
  }

  return { url, stop };
}
