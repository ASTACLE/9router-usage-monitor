<template>
  <div class="app-window">
    <!-- Title Bar -->
    <header class="titlebar">
      <div class="titlebar-left">
        <span class="icon">⬡</span>
        <span class="title">9router 用量监控</span>
        <span class="sub" v-if="lastUpdate">上次更新: {{ lastUpdate }}</span>
      </div>
      <div class="traffic-lights">
        <button class="dot dot-min" @click="minimize" title="最小化">
          <svg width="6" height="6" viewBox="0 0 7 7"><path d="M1.8 3.5h3.4" stroke="#8a6e00" stroke-width="1.3"/></svg>
        </button>
        <button class="dot dot-close" @click="closeWin" title="关闭到托盘">
          <svg width="6" height="6" viewBox="0 0 7 7"><path d="M1.2 1.2l4.6 4.6M5.8 1.2l-4.6 4.6" stroke="#4a0e0e" stroke-width="1.3"/></svg>
        </button>
      </div>
    </header>

    <!-- Status Bar -->
    <div class="statusbar">
      <div :class="['led', { running, starting }]" />
      <span class="st-label">{{ starting ? '启动中…' : running ? '运行中' : '已停止' }}</span>
      <span class="st-url" v-if="running">localhost:20128</span>
      <div class="spacer" />
      <button v-if="!running && !starting" class="btn btn-start" @click="handleStart">▶ 启动服务</button>
      <template v-else>
        <button class="btn btn-refresh" @click="fetchData" :disabled="loading">🔄 {{ loading ? '获取中…' : '刷新' }}</button>
        <button class="btn btn-dash" @click="openDashboard">⬡ Dashboard</button>
        <button class="btn btn-stop" @click="handleStop">■ 停止</button>
      </template>
    </div>

    <!-- Main Content -->
    <main class="main" v-if="stats">
      <!-- Total Stats Bar -->
      <div class="total-bar">
        <div class="total-item">
          <span class="total-value">{{ stats.totalRequests }}</span>
          <span class="total-label">总请求</span>
        </div>
        <div class="total-item">
          <span class="total-value">{{ formatTokens(stats.totalPromptTokens) }}</span>
          <span class="total-label">输入 Tokens</span>
        </div>
        <div class="total-item">
          <span class="total-value">{{ formatTokens(stats.totalCompletionTokens) }}</span>
          <span class="total-label">输出 Tokens</span>
        </div>
        <div class="total-item">
          <span class="total-value cost">${{ stats.totalCost.toFixed(4) }}</span>
          <span class="total-label">总费用</span>
        </div>
      </div>

      <!-- Provider Cards -->
      <div class="section-head">
        <span class="section-title">供应商用量 ({{ providerKeys.length }})</span>
      </div>
      <div class="provider-grid">
        <div v-for="key in providerKeys" :key="key" class="provider-card" :style="{ borderLeftColor: providerColor(key) }">
          <div class="pc-head">
            <span class="pc-name">{{ providerName(key) }}</span>
            <span class="pc-cost">${{ stats.byProvider[key].cost.toFixed(4) }}</span>
          </div>
          <div class="pc-stats">
            <div class="pc-stat">
              <span class="ps-v">{{ stats.byProvider[key].requests }}</span>
              <span class="ps-l">请求</span>
            </div>
            <div class="pc-stat">
              <span class="ps-v">{{ formatTokens(stats.byProvider[key].promptTokens) }}</span>
              <span class="ps-l">输入</span>
            </div>
            <div class="pc-stat">
              <span class="ps-v">{{ formatTokens(stats.byProvider[key].completionTokens) }}</span>
              <span class="ps-l">输出</span>
            </div>
          </div>
          <!-- Models under this provider -->
          <div class="pc-models" v-if="modelsByProvider(key).length > 0">
            <div v-for="m in modelsByProvider(key).slice(0, 5)" :key="m.key" class="model-row">
              <span class="mr-name" :title="m.model">{{ shortModel(m.model) }}</span>
              <span class="mr-req">{{ m.requests }}次</span>
              <span class="mr-tok">{{ formatTokens(m.promptTokens + m.completionTokens) }}</span>
              <span class="mr-cost">${{ m.cost.toFixed(4) }}</span>
            </div>
            <div v-if="modelsByProvider(key).length > 5" class="model-more">+{{ modelsByProvider(key).length - 5 }} 更多</div>
          </div>
        </div>
      </div>

      <!-- Recent Requests -->
      <div class="section-head" v-if="recentRequests.length > 0">
        <span class="section-title">Recent Requests ({{ recentRequests.length }})</span>
      </div>
      <div class="recent-table" v-if="recentRequests.length > 0">
        <div class="rt-head">
          <span class="rt-h">时间</span>
          <span class="rt-h">模型</span>
          <span class="rt-h">供应商</span>
          <span class="rt-h num">输入</span>
          <span class="rt-h num">输出</span>
          <span class="rt-h">状态</span>
        </div>
        <div v-for="(req, i) in recentRequests" :key="i" class="rt-row" :class="{ alt: i % 2 === 1 }">
          <span class="rt-c time">{{ formatTime(req.timestamp) }}</span>
          <span class="rt-c model" :title="req.model">{{ shortModel(req.model) }}</span>
          <span class="rt-c prov">{{ req.provider }}</span>
          <span class="rt-c num">{{ formatTokensCompact(req.promptTokens) }}</span>
          <span class="rt-c num">{{ formatTokensCompact(req.completionTokens) }}</span>
          <span class="rt-c status" :class="req.status">{{ req.status || 'ok' }}</span>
        </div>
      </div>
    </main>

    <!-- Empty State -->
    <main class="main empty" v-else-if="running">
      <div class="empty-icon">📊</div>
      <div class="empty-text">点击「刷新」获取用量数据</div>
    </main>
    <main class="main empty" v-else>
      <div class="empty-icon">⬡</div>
      <div class="empty-text">启动 9router 服务后自动打开 Dashboard</div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";

const running = ref(false);
const starting = ref(false);
const loading = ref(false);
const stats = ref<any>(null);
const providers = ref<any>(null);
const lastUpdate = ref("");
const recentRequests = ref<any[]>([]);

function minimize() { window.electronAPI.minimize(); }
function closeWin() { window.electronAPI.close(); }

async function handleStart() {
  starting.value = true;
  const result = await window.electronAPI.startService();
  running.value = result.success;
  starting.value = false;
  if (running.value) setTimeout(fetchData, 3000);
}

async function handleStop() {
  await window.electronAPI.stopService();
  running.value = false;
  stats.value = null;
}

function openDashboard() { window.electronAPI.openDashboard(); }

async function fetchData() {
  if (loading.value) return;
  loading.value = true;
  try {
    const result = await window.electronAPI.fetchUsage();
    if (result.success) {
      stats.value = result.stats;
      providers.value = result.providers;
      recentRequests.value = result.stats?.recentRequests || [];
      lastUpdate.value = new Date().toLocaleTimeString();
    }
  } catch {}
  loading.value = false;
}

const providerKeys = computed(() => {
  if (!stats.value?.byProvider) return [];
  return Object.keys(stats.value.byProvider).sort((a, b) => stats.value.byProvider[b].cost - stats.value.byProvider[a].cost);
});

const colors = ["#818cf8","#22c55e","#f59e0b","#ef4444","#ec4899","#06b6d4","#a855f7","#14b8a6","#f97316","#6366f1"];
function providerColor(key: string) {
  const idx = providerKeys.value.indexOf(key);
  return colors[idx % colors.length];
}

function providerName(key: string) {
  if (!providers.value?.providers) return key;
  const p = providers.value.providers.find((p: any) => p.id === key);
  return p?.name || key;
}

function modelsByProvider(providerKey: string) {
  if (!stats.value?.byModel) return [];
  return Object.entries(stats.value.byModel)
    .filter(([k]) => k.includes(`(${providerKey})`))
    .map(([k, v]: [string, any]) => ({ key: k, model: k.replace(` (${providerKey})`, ''), ...v }))
    .sort((a, b) => b.cost - a.cost);
}

function shortModel(m: string) {
  if (m.length > 30) return m.substring(0, 28) + '…';
  return m;
}

function formatTokens(n: number) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatTokensCompact(n: number) {
  if (!n) return "-";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatTime(ts: string) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  const s = await window.electronAPI.getStatus();
  running.value = s.running;

  window.electronAPI.onStatusChange(s => { running.value = s.running; starting.value = false; });

  if (running.value) {
    await fetchData();
  }

  // Auto-refresh every 30 seconds
  pollTimer = setInterval(() => {
    if (running.value) fetchData();
  }, 30000);
});

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>

<style scoped>
.app-window { display: flex; flex-direction: column; height: 100vh; background: #0f0f11; }

/* Title Bar */
.titlebar {
  display: flex; align-items: center; height: 34px;
  padding: 0 10px 0 14px; background: #141416;
  border-bottom: 1px solid #2e2e34;
  -webkit-app-region: drag; user-select: none; flex-shrink: 0;
}
.titlebar-left { display: flex; align-items: center; gap: 6px; flex: 1; }
.icon { color: #818cf8; font-size: 15px; }
.title { font-size: 12px; font-weight: 500; color: #e4e4e7; }
.sub { font-size: 10px; color: #52525b; margin-left: 8px; }

.traffic-lights { display: flex; align-items: center; gap: 5px; -webkit-app-region: no-drag; }
.dot {
  all: unset; width: 10px; height: 10px; border-radius: 50%;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: filter 0.12s;
}
.dot svg { opacity: 0; transition: opacity 0.12s; pointer-events: none; }
.dot:hover svg { opacity: 1; }
.dot-close { background: #ff5f57; }
.dot-min { background: #ffbd2e; }

/* Status Bar */
.statusbar {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 12px; height: 32px; background: #111113;
  border-bottom: 1px solid #1c1c1f; flex-shrink: 0;
}
.led { width: 6px; height: 6px; border-radius: 50%; background: #3e3e44; transition: all 0.3s; }
.led.running { background: #22c55e; box-shadow: 0 0 5px rgba(34,197,94,0.4); }
.led.starting { background: #f59e0b; animation: pulse 0.8s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
.st-label { font-size: 11px; font-weight: 500; color: #52525b; }
.st-label:has(+ .st-url) { color: #e4e4e7; }
.st-url { font-size: 10px; color: #3e3e44; font-family: Consolas,monospace; }
.spacer { flex: 1; }

.btn {
  all: unset; font-size: 11px; font-weight: 500; padding: 3px 10px;
  border-radius: 4px; cursor: pointer; transition: all 0.12s;
}
.btn:disabled { opacity: 0.5; cursor: default; }
.btn-start { color: #22c55e; }
.btn-start:hover:not(:disabled) { background: rgba(34,197,94,0.1); }
.btn-refresh { color: #a1a1aa; }
.btn-refresh:hover:not(:disabled) { background: rgba(161,161,170,0.1); }
.btn-dash { color: #818cf8; }
.btn-dash:hover { background: rgba(129,140,248,0.1); }
.btn-stop { color: #ef4444; }
.btn-stop:hover { background: rgba(239,68,68,0.1); }

/* Main */
.main { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
.main.empty { align-items: center; justify-content: center; gap: 8px; background: #0f0f11; }
.empty-icon { font-size: 48px; }
.empty-text { font-size: 13px; color: #52525b; }

/* Total Bar */
.total-bar {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
}
.total-item {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: #18181b; border: 1px solid #2e2e34; border-radius: 8px;
  padding: 12px 8px;
}
.total-value { font-size: 18px; font-weight: 700; color: #e4e4e7; font-family: Consolas,monospace; }
.total-value.cost { color: #22c55e; }
.total-label { font-size: 10px; color: #52525b; text-transform: uppercase; letter-spacing: 0.3px; }

/* Sections */
.section-head { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
.section-title { font-size: 12px; font-weight: 600; color: #a1a1aa; }

/* Provider Grid */
.provider-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px; }
.provider-card {
  background: #18181b; border: 1px solid #2e2e34; border-left: 3px solid #818cf8;
  border-radius: 8px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.pc-head { display: flex; align-items: center; justify-content: space-between; }
.pc-name { font-size: 13px; font-weight: 600; color: #e4e4e7; }
.pc-cost { font-size: 13px; font-weight: 600; color: #22c55e; font-family: Consolas,monospace; }

.pc-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.pc-stat { display: flex; flex-direction: column; gap: 0; }
.ps-v { font-size: 14px; font-weight: 600; color: #e4e4e7; font-family: Consolas,monospace; }
.ps-l { font-size: 9px; color: #52525b; text-transform: uppercase; }

.pc-models { display: flex; flex-direction: column; gap: 1px; margin-top: 4px; padding-top: 6px; border-top: 1px solid #1c1c1f; }
.model-row {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; padding: 2px 4px; border-radius: 3px;
}
.model-row:hover { background: #1c1c1f; }
.mr-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #a1a1aa; }
.mr-req { color: #71717a; width: 28px; text-align: right; }
.mr-tok { color: #71717a; width: 50px; text-align: right; font-family: Consolas,monospace; }
.mr-cost { color: #22c55e; width: 60px; text-align: right; font-family: Consolas,monospace; }
.model-more { font-size: 10px; color: #3e3e44; padding: 2px 4px; }

/* Recent Requests Table */
.recent-table {
  background: #18181b; border: 1px solid #2e2e34; border-radius: 8px; overflow: hidden;
}
.rt-head, .rt-row {
  display: grid; grid-template-columns: 80px 1fr 80px 60px 60px 60px;
  gap: 4px; padding: 5px 10px; font-size: 11px;
}
.rt-h { color: #52525b; font-weight: 500; text-transform: uppercase; font-size: 10px; }
.rt-h.num { text-align: right; }
.rt-row.alt { background: #151517; }
.rt-c { color: #a1a1aa; font-family: Consolas,monospace; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rt-c.time { color: #71717a; }
.rt-c.model { font-family: inherit; color: #e4e4e7; }
.rt-c.num { text-align: right; color: #71717a; }
.rt-c.status { text-align: center; }
.rt-c.status.ok { color: #22c55e; }
.rt-c.status.error, .rt-c.status.failed { color: #ef4444; }
</style>
