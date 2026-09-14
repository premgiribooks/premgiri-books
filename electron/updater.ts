import { app, BrowserWindow, dialog, ipcMain, Notification } from "electron";
import { autoUpdater } from "electron-updater";
import type { Logger } from "./logger";
import type { UpdateStatus } from "./update-status";
import { UPDATE_CHECK_CHANNEL, UPDATE_INSTALL_CHANNEL, UPDATE_STATUS_CHANNEL } from "./ipc-channels";

let mainWindow: BrowserWindow | null = null;
let isInitialized = false;

function broadcastStatus(status: UpdateStatus): void {
  mainWindow?.webContents.send(UPDATE_STATUS_CHANNEL, status);
}

/**
 * The one previously-real failure mode here: `premgiribooks/premgiri-books`
 * going private (or losing its releases) makes electron-updater's GitHub
 * provider 404 on `releases.atom` for every installed app, silently
 * (`autoUpdater.autoDownload` never fires). electron-updater's HttpError
 * carries `statusCode`/`code` alongside the generic `Error.message` — check
 * for that shape instead of string-matching the raw log line, and surface a
 * message that names the actual cause instead of a raw HTTP stack, so this
 * doesn't require digging through main.log to diagnose again (see
 * docs/release-process.md's "Private repo + electron-updater" note; a CI
 * guard in .github/workflows/release.yml now also refuses to publish a
 * release at all while the repo is private).
 */
function describeUpdateError(error: Error): string {
  const statusCode = (error as { statusCode?: number }).statusCode;
  if (statusCode === 404) {
    return (
      "Couldn't reach the update feed (404 from GitHub Releases). This happens when the " +
      "releases repo is private or has no published release yet — see " +
      "docs/release-process.md's \"Private repo + electron-updater\" note."
    );
  }
  return error.message;
}

function notifyUpdateDownloaded(version: string): void {
  if (!Notification.isSupported()) {
    return;
  }

  const notification = new Notification({
    title: "Update ready to install",
    body: `Premgiri Books ERP ${version} has been downloaded. Restart to install, or it will install automatically the next time you quit.`,
  });

  notification.on("click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  notification.show();
}

/**
 * Wires electron-updater's events to the renderer (via UPDATE_STATUS_CHANNEL,
 * consumed by src/components/system/update-notification.tsx) and to a native
 * OS notification once a download completes. `autoInstallOnAppQuit` staying
 * true means "Later" is a real option, not just a dismiss: an update the
 * user defers still installs itself the next time they close the app.
 *
 * Safe to call on every window creation: on macOS, closing all windows
 * doesn't quit the app, and the dock's "activate" flow creates a new
 * `BrowserWindow` — re-running the one-time listener/IPC-handler setup below
 * would throw ("second handler for …") on `ipcMain.handle` and duplicate
 * every `autoUpdater` event broadcast and native notification. Only the
 * `mainWindow` reference (used for broadcasting and for focusing on
 * notification click) needs to track the current window.
 */
export function initializeAutoUpdater(window: BrowserWindow, logger: Logger): void {
  mainWindow = window;

  if (isInitialized) {
    return;
  }
  isInitialized = true;

  autoUpdater.logger = logger;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => broadcastStatus({ state: "checking" }));
  autoUpdater.on("update-available", (info) =>
    broadcastStatus({ state: "available", version: info.version }),
  );
  autoUpdater.on("update-not-available", () => broadcastStatus({ state: "not-available" }));
  autoUpdater.on("download-progress", (progress) =>
    broadcastStatus({ state: "downloading", percent: Math.round(progress.percent) }),
  );
  autoUpdater.on("update-downloaded", (info) => {
    broadcastStatus({ state: "downloaded", version: info.version });
    notifyUpdateDownloaded(info.version);
  });
  autoUpdater.on("error", (error) => {
    const message = describeUpdateError(error);
    logger.error({ error, message }, "Auto-update check failed");
    broadcastStatus({ state: "error", message });
  });

  ipcMain.handle(UPDATE_CHECK_CHANNEL, () => checkForUpdatesManually());
  ipcMain.on(UPDATE_INSTALL_CHANNEL, () => autoUpdater.quitAndInstall());
}

/** Silent background check, run once shortly after the window loads. */
export function checkForUpdatesOnStartup(): void {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.checkForUpdates().catch(() => {
    // The "error" listener above already reports this to the logger and the
    // renderer; nothing further to do for an unattended background check.
  });
}

/**
 * Used by both the renderer's "Check for updates" action and the Help menu's
 * "Check for Updates…" item. Unlike the silent startup check, a
 * user-initiated check always resolves to a visible outcome — a dialog when
 * there's nothing new or something went wrong, and the shared status
 * broadcast (surfaced as a toast) when an update is found.
 */
export async function checkForUpdatesManually(): Promise<void> {
  if (!app.isPackaged) {
    await dialog.showMessageBox({
      type: "info",
      message: "Updates are only available in an installed build.",
    });
    return;
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.isUpdateAvailable) {
      await dialog.showMessageBox({
        type: "info",
        message: "You're up to date.",
        detail: `Premgiri Books ERP ${app.getVersion()} is the latest version.`,
      });
    }
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      message: "Couldn't check for updates.",
      detail: error instanceof Error ? describeUpdateError(error) : String(error),
    });
  }
}
