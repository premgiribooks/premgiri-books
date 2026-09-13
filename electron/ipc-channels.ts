/**
 * Shared IPC channel names for the update flow. Kept in their own file (no
 * other imports) so preload.ts — which runs in the renderer's isolated
 * preload context — never has to pull in updater.ts's main-process-only
 * dependencies (electron-updater, ipcMain, dialog) just to read a constant.
 */
export const UPDATE_STATUS_CHANNEL = "updater:status";
export const UPDATE_CHECK_CHANNEL = "updater:check";
export const UPDATE_INSTALL_CHANNEL = "updater:install";
