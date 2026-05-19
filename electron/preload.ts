import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
  minimize: () => ipcRenderer.send("win-minimize"),
  minimizeTray: () => ipcRenderer.send("win-minimize-tray"),
  close: () => ipcRenderer.send("win-close"),

  startService: (): Promise<{success: boolean; error?: string}> => ipcRenderer.invoke("service-start"),
  stopService: () => ipcRenderer.invoke("service-stop"),
  getStatus: () => ipcRenderer.invoke("service-status"),
  getLogs: (): Promise<string> => ipcRenderer.invoke("get-logs"),
  fetchUsage: () => ipcRenderer.invoke("fetch-usage"),
  fetchRecent: () => ipcRenderer.invoke("fetch-recent"),
  openDashboard: () => ipcRenderer.invoke("open-dashboard"),

  onLog: (cb: (m: string) => void) => { ipcRenderer.on("app-log", (_e, m) => cb(m)); },
  onStatusChange: (cb: (s: {running: boolean}) => void) => { ipcRenderer.on("service-status", (_e, s) => cb(s)); },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
