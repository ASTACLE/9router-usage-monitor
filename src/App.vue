<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <Dashboard />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { darkTheme } from "naive-ui";
import type { GlobalThemeOverrides } from "naive-ui";
import Dashboard from "./views/dashboard/Dashboard.vue";

const themeOverrides: GlobalThemeOverrides = {
  common: {
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    fontFamilyMono: '"Consolas", "Cascadia Code", monospace',
    primaryColor: "#818cf8", primaryColorHover: "#6366f1",
    borderRadius: "8px", bodyColor: "#0f0f11",
  },
};
</script>
<style>
*, *::before, *::after { box-sizing: border-box; }
html, body, #app { margin: 0; padding: 0; height: 100%; background: #0f0f11; color: #e4e4e7; }
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2e2e34; border-radius: 2px; }
</style>
