<template>
  <div class="console-panel" :class="{ collapsed: !consoleOpen }">
    <!-- Drag handle (visible when expanded) -->
    <div
      v-if="consoleOpen"
      class="drag-handle"
      @mousedown="startResize"
    />

    <!-- Expanded content -->
    <template v-if="consoleOpen">
      <div class="console-header">
        <span class="console-title">Console</span>
        <div class="console-actions">
          <label class="auto-refresh-label">
            <input type="checkbox" :checked="autoRefresh" @change="toggleAutoRefresh" />
            Auto-refresh
          </label>
          <button class="console-btn" @click="fetchLogs" title="Refresh" :disabled="loading">&#8635;</button>
          <button class="console-btn" @click="toggleConsole" title="Close">&#10005;</button>
        </div>
      </div>
      <LogFilters
        :modelLevel="activeLevel"
        @update:modelLevel="onLevelChange"
      />
      <LogOutput
        :lines="filteredLines"
        :loading="loading"
        :error="error"
      />
      <div class="console-footer-bar">
        <span class="line-count">{{ returnedLines }} of {{ totalLines }} lines</span>
        <span v-if="sseConnected" class="sse-status connected">SSE Connected</span>
        <span v-else class="sse-status disconnected">SSE Disconnected</span>
      </div>
    </template>

    <!-- Collapsed footer bar (always visible when collapsed) -->
    <div v-if="!consoleOpen" class="console-footer" @click="toggleConsole()">
      <span class="footer-left">
        Logs <span class="footer-arrow">&#9650;</span>
      </span>
      <span v-if="newMessageCount > 0" class="new-messages">
        {{ newMessageCount }} new messages
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLogsStore } from '@/stores/logs'
import { useAnalysisStore } from '@/stores/analysis'
import LogFilters from './LogFilters.vue'
import LogOutput from './LogOutput.vue'

const logsStore = useLogsStore()
const analysisStore = useAnalysisStore()
const { connected: sseConnected } = storeToRefs(analysisStore)

const {
  consoleOpen,
  consoleHeight,
  activeLevel,
  autoRefresh,
  loading,
  error,
  filteredLines,
  newMessageCount,
  totalLines,
  returnedLines,
} = storeToRefs(logsStore)

const { fetchLogs, toggleConsole, setConsoleHeight, startAutoRefresh, stopAutoRefresh } = logsStore

// Start auto-refresh + SSE on mount
startAutoRefresh()
analysisStore.connectSSE()

function toggleAutoRefresh() {
  if (autoRefresh.value) {
    stopAutoRefresh()
  } else {
    startAutoRefresh()
  }
}

function onLevelChange(level: string) {
  activeLevel.value = level
  fetchLogs()
}

function startResize(e: MouseEvent) {
  e.preventDefault()
  const startY = e.clientY
  const startH = consoleHeight.value

  function onMove(ev: MouseEvent) {
    const delta = startY - ev.clientY
    const newH = Math.min(Math.max(startH + delta, 150), window.innerHeight * 0.6)
    setConsoleHeight(Math.round(newH))
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
</script>

<style scoped>
.console-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: v-bind(consoleHeight + 'px');
  background: var(--color-bg-primary, #fff);
  border-top: 1px solid var(--color-border);
  transition: height 0.2s ease;
}

.console-panel.collapsed {
  height: auto;
  min-height: 40px;
}

.drag-handle {
  height: 4px;
  background: var(--color-border);
  cursor: ns-resize;
  flex-shrink: 0;
}

.drag-handle:hover {
  background: var(--color-text-link, #0969da);
}

.console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--color-bg-secondary, #f6f8fa);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.console-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text-primary, #1f2328);
}

.console-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.auto-refresh-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary, #656d76);
  cursor: pointer;
  user-select: none;
}

.console-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-secondary, #656d76);
  line-height: 1;
}

.console-btn:hover {
  background: var(--color-bg-tertiary, #f0f2f5);
}

.console-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.console-footer-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--color-bg-secondary, #f6f8fa);
  border-top: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-secondary, #656d76);
  flex-shrink: 0;
}

.sse-status {
  font-weight: 500;
}

.sse-status.connected {
  color: #3fb950;
}

.sse-status.disconnected {
  color: #f85149;
}

.console-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--color-bg-secondary, #f6f8fa);
  cursor: pointer;
  flex-shrink: 0;
  user-select: none;
}

.footer-left {
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text-primary, #1f2328);
}

.footer-arrow {
  font-size: 10px;
  margin-left: 4px;
}

.new-messages {
  font-size: 12px;
  color: var(--color-text-link, #0969da);
}
</style>
