import { app, BrowserWindow } from "electron";
import path from "node:path";
import { installApplicationMenu } from "./menu";
import { createElectronLogger, type Logger } from "./logger";
import { startNextServer, type RunningServer } from "./server";
import { checkForUpdatesOnStartup, initializeAutoUpdater } from "./updater";

const DEV_SERVER_URL = "http://localhost:3000";

const isDev = !app.isPackaged;

let logger: Logger;
let runningServer: RunningServer | null = null;

/**
 * In dev, Electron loads the separately-running `next dev` server. In a
 * packaged build there is no dev server — the bundled Next.js standalone
 * server (see ./server.ts) is spawned once and reused across window
 * recreations (e.g. the macOS dock "activate" flow below).
 */
async function resolveAppUrl(): Promise<string> {
  if (isDev) {
    return DEV_SERVER_URL;
  }

  if (!runningServer) {
    runningServer = await startNextServer(
      {
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        projectRoot: app.getAppPath(),
      },
      logger,
    );
  }

  return runningServer.url;
}

async function createMainWindow(): Promise<BrowserWindow> {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const url = await resolveAppUrl();
  await mainWindow.loadURL(url);

  registerBackForwardNavigation(mainWindow);
  initializeAutoUpdater(mainWindow, logger);
  checkForUpdatesOnStartup();

  return mainWindow;
}

/**
 * The app is a single-page Next.js client app loaded once via loadURL —
 * all in-app navigation happens through the History API (App Router), which
 * Chromium records as same-document session-history entries same as a
 * regular browser tab. Wires the OS-level back/forward affordances a
 * browser tab gets for free but a bare BrowserWindow does not: the mouse
 * side (thumb) buttons, and Alt+Left/Alt+Right as a keyboard fallback since
 * autoHideMenuBar leaves no visible menu bar to carry an accelerator.
 */
function registerBackForwardNavigation(window: BrowserWindow): void {
  // Windows/Linux mouse back/forward buttons surface as app-command events.
  window.on("app-command", (_event, command) => {
    if (command === "browser-backward" && window.webContents.navigationHistory.canGoBack()) {
      window.webContents.navigationHistory.goBack();
    } else if (
      command === "browser-forward" &&
      window.webContents.navigationHistory.canGoForward()
    ) {
      window.webContents.navigationHistory.goForward();
    }
  });

  window.webContents.on("before-input-event", (event, input) => {
    const isArrowKey = input.key === "Left" || input.key === "Right";
    if (input.type !== "keyDown" || !isArrowKey || !input.alt) {
      return;
    }

    // Prevent Chromium's/the page's own default handling of Alt+Arrow
    // before triggering our own navigation, so the two can never both fire.
    event.preventDefault();

    if (input.key === "Left" && window.webContents.navigationHistory.canGoBack()) {
      window.webContents.navigationHistory.goBack();
    } else if (input.key === "Right" && window.webContents.navigationHistory.canGoForward()) {
      window.webContents.navigationHistory.goForward();
    }
  });
}

app.whenReady().then(async () => {
  logger = createElectronLogger(app.getPath("userData"));
  installApplicationMenu();

  try {
    await createMainWindow();
  } catch (error) {
    logger.error({ error }, "Failed to start the local application server");
    app.quit();
    return;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().catch((error: unknown) => {
        logger.error({ error }, "Failed to recreate the main window on activate");
      });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

let isQuittingForReal = false;

/**
 * Must actually wait for the standalone server child to exit — not just send
 * it a kill signal — before letting the app quit for real. That child shares
 * the packaged app's own .exe (see server.ts), so an update's silent install
 * (electron-updater's quitAndInstall, wired in updater.ts) races against
 * Windows still listing it as running if this doesn't block. preventDefault
 * + a guard flag turns Electron's normally-synchronous "quit" into one that
 * waits on this async cleanup exactly once, then re-triggers it for real.
 */
app.on("before-quit", (event) => {
  if (isQuittingForReal || !runningServer) {
    return;
  }

  event.preventDefault();
  isQuittingForReal = true;

  runningServer
    .stop()
    .catch((error: unknown) => logger.error({ error }, "Error stopping local server during quit"))
    .finally(() => app.quit());
});
