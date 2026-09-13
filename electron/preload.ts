import { contextBridge, ipcRenderer } from "electron";
import { UPDATE_CHECK_CHANNEL, UPDATE_INSTALL_CHANNEL, UPDATE_STATUS_CHANNEL } from "./ipc-channels";
import type { UpdateStatus } from "./update-status";

contextBridge.exposeInMainWorld("api", {
  updater: {
    onStatus(callback: (status: UpdateStatus) => void): () => void {
      const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus): void =>
        callback(status);
      ipcRenderer.on(UPDATE_STATUS_CHANNEL, listener);
      return () => ipcRenderer.removeListener(UPDATE_STATUS_CHANNEL, listener);
    },
    checkForUpdates(): Promise<void> {
      return ipcRenderer.invoke(UPDATE_CHECK_CHANNEL);
    },
    installUpdate(): void {
      ipcRenderer.send(UPDATE_INSTALL_CHANNEL);
    },
  },
});
