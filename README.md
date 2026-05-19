# 9router Usage Monitor ⬡

<div align="center">

![Electron](https://img.shields.io/badge/Electron-35.x-47848F?logo=electron&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Naive UI](https://img.shields.io/badge/UI-Naive_UI-818cf8)
![License](https://img.shields.io/badge/License-MIT-green)

**9router 大模型用量监控桌面端** — 启动 9router、自动打开 Dashboard、实时爬取 API 用量数据并图形化展示。

<img src="resources/icon.ico" width="64" alt="logo" />

</div>

---

## 功能

| 功能 | 说明 |
|------|------|
| 🚀 **一键启动** | 启动 9router 后台服务，自动打开浏览器 Dashboard |
| 📊 **用量总览** | 总请求数、输入/输出 Tokens、总费用，一目了然 |
| 🏢 **供应商详情** | 按供应商分组的请求量、Tokean、费用卡片 |
| 🔬 **模型明细** | 每个供应商旗下各模型的用量分解 |
| 📋 **Recent Requests** | 最近 20 条请求的时间、模型、供应商、Tokens、状态 |
| 🗃 **实时刷新** | 每 30 秒自动刷新数据 |
| ⬡ **暗色主题** | claude-permit-hub 同款深色界面，MacOS traffic-light 按钮 |
| 🔄 **自动登录** | 自动维护 Cookie，无需手动登录 |

## 界面预览

```
┌─ ⬡ 9router 用量监控 ── 上次更新: 13:11 🟡🔴 ──┐
│ ● 运行中  localhost:20128                      │
│            [🔄 刷新] [⬡ Dashboard] [■ 停止]     │
├─────────────────────────────────────────────────┤
│ ┌──────┬──────────┬──────────┬────────┐        │
│ │ 1612 │  94.2M   │  351.8K  │  $8.44 │        │
│ │总请求 │ 输入 Tok │ 输出 Tok │ 总费用  │        │
│ └──────┴──────────┴──────────┴────────┘        │
│                                                 │
│ 供应商用量 (9)                                   │
│ ┌─── DeepSeek ─── $0.78 ─┐ ┌── OpenRouter ─┐   │
│ │ 687请求  5.4M/119K     │ │ 426请求      │   │
│ │ ├ deepseek-v4-flash    │ │ ├ owl-alpha   │   │
│ │ └ deepseek-v4-pro-none │ │ └ deepseek..  │   │
│ └────────────────────────┘ └──────────────┘   │
│                                                 │
│ Recent Requests (20)                             │
│ ┌─时间──┬─模型──────────┬─供应商─┬─输入──┬─输出─┐│
│ │13:11  │ owl-alpha     │openrtr│358K  │ 226 ││
│ │13:11  │ owl-alpha     │openrtr│102K  │1.7K ││
│ └───────┴───────────────┴───────┴──────┴─────┘│
└─────────────────────────────────────────────────┘
```

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 20
- [9router](https://github.com/decolua/9router) 已全局安装 (`npm i -g 9router`)

### 下载运行

#### 方式一：直接使用打包版

从 [Releases](https://github.com/astacle/9router-usage-monitor/releases) 下载最新 `9router-usage-monitor.exe`，双击运行。

#### 方式二：源码运行

```bash
git clone https://github.com/astacle/9router-usage-monitor.git
cd 9router-usage-monitor
npm install
npm run dev
```

### 构建打包

```bash
npm run build
npm run pack        # 生成 release/win-unpacked/
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | [Electron 35](https://www.electronjs.org/) |
| 前端 | [Vue 3](https://vuejs.org/) + [Naive UI](https://www.naiveui.com/) |
| 构建 | [electron-vite](https://electron-vite.org/) + [electron-builder](https://www.electron.build/) |
| 数据源 | 9router API (`/api/usage/stats`) |
| 网络 | Electron `fetch` (Chromium 网络栈) |
| 图标 | 自绘 ⬡ 六边形图标 |

## 数据来源

所有用量数据均通过 9router 本地 API 获取：

- `POST /api/auth/login` — 登录（密码 `123456`）
- `GET /api/usage/stats` — 完整用量统计
- `GET /api/usage/providers` — 供应商列表

应用自动维护 Cookie 会话，过期自动重新登录。

## 项目结构

```
9router-usage-monitor/
├── electron/
│   ├── main.ts          # Electron 主进程（服务管理 + API 爬取）
│   └── preload.ts       # 安全 IPC 桥接
├── src/
│   ├── App.vue          # 根组件 + 主题配置
│   ├── main.ts          # Vue 入口
│   └── views/
│       └── dashboard/
│           └── Dashboard.vue  # 用量监控主界面
├── resources/
│   └── icon.ico         # 应用图标
├── package.json
├── electron.vite.config.ts
└── README.md
```

## License

MIT
