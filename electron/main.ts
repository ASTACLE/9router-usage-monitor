import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from "electron";
import { join } from "path";
import { spawn, execSync } from "child_process";
import { existsSync, writeFileSync, readFileSync } from "fs";

const HOME = app.getPath("home");
const COOKIE_FILE = join(HOME, ".9router-monitor-cookie.json");
const logLines: string[] = [];
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let serviceRunning = false;

const SERVICE_BASE = "http://localhost:20128";
const iconPath = app.isPackaged
  ? join(process.resourcesPath, "icon.ico")
  : join(__dirname, "../../resources/icon.ico");

function pushLog(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  logLines.push(`[${ts}] ${msg}`);
  if (logLines.length > 500) logLines.splice(0, 100);
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send("app-log", msg); } catch {}
  }
}

// ── 9router service ──
function findNodeAndCli(): { node: string; cli: string } | null {
  const npmDir = join(HOME, "AppData", "Roaming", "npm");
  for (const p of [
    "D:\\Program Files (x86)\\Node.js\\node.exe",
    "C:\\Program Files\\nodejs\\node.exe",
    join(npmDir, "node.exe"),
  ]) { if (existsSync(p)) {
    const cli = join(npmDir, "node_modules", "9router", "cli.js");
    return existsSync(cli) ? { node: p, cli } : { node: p, cli: "" };
  }}
  return null;
}

function startService(): { ok: boolean; error?: string } {
  pushLog("── 启动服务 ──");
  if (serviceRunning) return { ok: true };
  try { stopService(); } catch {}
  const found = findNodeAndCli();
  if (!found) return { ok: false, error: "找不到 node.exe" };
  try {
    const cmd = found.cli ? found.node : "cmd.exe";
    const args = found.cli ? [found.cli, "--skip-update", "--tray", "--no-browser"] : ["/c", "npx", "--yes", "9router"];
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"], windowsHide: true, detached: true,
      shell: process.platform === "win32" && !found.cli, cwd: HOME,
      env: { ...process.env, PORT: "20128", HOSTNAME: "0.0.0.0" },
    });
    if (!child.pid) return { ok: false, error: "spawn 失败" };
    pushLog(`  PID: ${child.pid}`);
    child.unref();
    return { ok: true };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

function stopService(): void {
  pushLog("── 停止服务 ──");
  try {
    const out = execSync(`netstat -ano | findstr ":20128 "`, { timeout: 3000, encoding: "utf-8" });
    const pids = new Set<number>();
    out.trim().split(/\r?\n/).forEach(l => { const m = l.trim().match(/(\d+)$/); if (m) { const pid = parseInt(m[1]); if (pid > 0 && pid !== process.pid) pids.add(pid); } });
    pids.forEach(pid => { try { execSync(`taskkill /F /T /PID ${pid}`, { timeout: 3000 }); } catch {}; });
  } catch {}
  serviceRunning = false;
}

function checkHealth(): Promise<boolean> {
  return fetch(`${SERVICE_BASE}/api/health`, { signal: AbortSignal.timeout(3000) })
    .then(r => { serviceRunning = r.ok; return r.ok; })
    .catch(() => { serviceRunning = false; return false; });
}

function notifyStatus(run: boolean) {
  if (mainWindow && !mainWindow.isDestroyed()) try { mainWindow.webContents.send("service-status", { running: run }); } catch {}
}

// ── Cookie-managed fetch ──
function getCookie(): string {
  try {
    if (existsSync(COOKIE_FILE)) {
      const data = JSON.parse(readFileSync(COOKIE_FILE, "utf-8"));
      if (Date.now() - (data.savedAt || 0) < 3600000 && data.cookie) return data.cookie;
    }
  } catch {}
  return "";
}

function setCookie(cookie: string) {
  try { writeFileSync(COOKIE_FILE, JSON.stringify({ cookie, savedAt: Date.now() }), "utf-8"); } catch {}
}

async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const cookie = getCookie();
  const headers: Record<string, string> = { "User-Agent": "9router-monitor/1.0" };
  if (cookie) headers["Cookie"] = cookie;
  if (options?.headers) Object.assign(headers, options.headers);

  const res = await fetch(`${SERVICE_BASE}${path}`, { ...options, headers, signal: AbortSignal.timeout(8000) });

  // Handle 401 — re-login and retry
  if (res.status === 401) {
    pushLog("  Cookie 过期，重新登录...");
    const loginRes = await fetch(`${SERVICE_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "123456" }),
    });
    const setCookieHeader = loginRes.headers.get("set-cookie");
    if (setCookieHeader) {
      const c = setCookieHeader.split(";")[0];
      setCookie(c);
      pushLog("  重新登录成功");
    }
    // Retry original request
    const retryRes = await fetch(`${SERVICE_BASE}${path}`, {
      ...options,
      headers: { ...headers, Cookie: getCookie() },
      signal: AbortSignal.timeout(8000),
    });
    return retryRes.json();
  }

  return res.json();
}

// ── Fetch usage data ──
async function fetchUsageData() {
  pushLog("── 获取用量数据 ──");

  const [stats, providers] = await Promise.all([
    apiFetch("/api/usage/stats"),
    apiFetch("/api/usage/providers"),
  ]);

  return { success: true, timestamp: new Date().toISOString(), stats, providers };
}

// ── Fetch recent requests ──
async function fetchRecentRequests() {
  pushLog("── 获取最近请求 ──");
  const stats = await apiGet("/api/usage/stats");
  return stats?.recentRequests || [];
}

// ── Open 9router dashboard in default browser ──
function openDashboard() {
  shell.openExternal(`${SERVICE_BASE}/dashboard`);
}

// ── Window ──
function createWindow() {
  pushLog("── 创建窗口 ──");
  mainWindow = new BrowserWindow({
    width: 900, height: 640, minWidth: 700, minHeight: 500,
    frame: false, backgroundColor: "#0f0f11", icon: iconPath,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  });
  mainWindow.on("page-title-updated", e => e.preventDefault());
  if (process.env.ELECTRON_RENDERER_URL) mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  else mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  mainWindow.on("close", event => {
    if (!isQuitting) { event.preventDefault(); mainWindow?.hide(); return false; }
  });
}

function createTray() {
  try {
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    if (icon.isEmpty()) return;
    tray = new Tray(icon);
    tray.setToolTip("9router 用量监控");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "显示窗口", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { label: "打开 Dashboard", click: openDashboard },
      { type: "separator" },
      { label: "退出", click: () => { isQuitting = true; stopService(); app.quit(); } },
    ]));
    tray.on("click", () => { mainWindow?.show(); mainWindow?.focus(); });
  } catch {}
}

// ── IPC ──
ipcMain.on("win-minimize", () => mainWindow?.minimize());
ipcMain.on("win-minimize-tray", () => mainWindow?.hide());
ipcMain.on("win-close", () => mainWindow?.hide());

ipcMain.handle("service-start", async () => {
  stopService();
  const result = startService();
  if (!result.ok) return { success: false, error: result.error };
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1500));
    if (await checkHealth()) {
      notifyStatus(true);
      // Auto-open dashboard in browser
      pushLog("  就绪，打开 Dashboard...");
      openDashboard();
      return { success: true };
    }
  }
  return { success: false, error: "启动超时" };
});
ipcMain.handle("service-stop", async () => { stopService(); notifyStatus(false); return { success: !(await checkHealth()) }; });
ipcMain.handle("service-status", async () => ({ running: await checkHealth() }));
ipcMain.handle("get-logs", () => logLines.join("\n"));
ipcMain.handle("fetch-usage", () => fetchUsageData());
ipcMain.handle("fetch-recent", () => fetchRecentRequests());
ipcMain.handle("open-dashboard", () => openDashboard());

app.whenReady().then(() => {
  pushLog("════ 9router 用量监控 ════");
  createWindow(); createTray();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("before-quit", () => { isQuitting = true; stopService(); });
