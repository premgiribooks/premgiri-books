/**
 * The API preload.ts exposes via contextBridge. Mirrors (does not import)
 * electron/update-status.ts's UpdateStatus, since electron/ and src/ compile
 * as separate TypeScript projects — keep both in sync when this shape
 * changes. `window.api` only exists inside the Electron renderer; code
 * running in a plain browser tab (e.g. `next dev` opened directly for fast
 * iteration) must guard every access with `window.api?.`.
 */
type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "not-available" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };

interface ElectronUpdaterApi {
  onStatus(callback: (status: UpdateStatus) => void): () => void;
  checkForUpdates(): Promise<void>;
  installUpdate(): void;
}

interface ElectronApi {
  updater: ElectronUpdaterApi;
}

interface Window {
  api?: ElectronApi;
}
