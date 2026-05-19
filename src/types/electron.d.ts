export {};
declare global {
  interface Window {
    electronAPI: {
      minimize: () => void;
      minimizeTray: () => void;
      close: () => void;
      startService: () => Promise<{success: boolean; error?: string}>;
      stopService: () => Promise<{success: boolean}>;
      getStatus: () => Promise<{running: boolean}>;
      getLogs: () => Promise<string>;
      fetchUsage: () => Promise<any>;
      fetchRecent: () => Promise<any[]>;
      openDashboard: () => void;
      onLog: (cb: (m: string) => void) => void;
      onStatusChange: (cb: (s: {running: boolean}) => void) => void;
    };
  }
}
