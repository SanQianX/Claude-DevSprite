<template>
  <div class="logs-view">
    <AppHeader />

    <div class="logs-content">
      <div class="logs-toolbar">
        <h1 class="page-title">Worker Logs</h1>

        <div class="toolbar-controls">
          <div class="level-filters">
            <button
              v-for="lvl in levels"
              :key="lvl.key"
              :class="['level-btn', { active: activeLevel === lvl.key }]"
              @click="activeLevel = lvl.key"
            >
              {{ lvl.label }}
            </button>
          </div>

          <label class="auto-refresh-toggle">
            <input type="checkbox" v-model="autoRefresh" />
            Auto-refresh
          </label>

          <button class="refresh-btn" @click="fetchLogs" :disabled="loading">
            Refresh
          </button>
        </div>
      </div>

      <div v-if="loading && !logs" class="loading-container">
        <LoadingSpinner />
      </div>

      <div v-else-if="error" class="error-container">
        <p class="error-message">{{ error }}</p>
        <button @click="fetchLogs" class="retry-button">Retry</button>
      </div>

      <div v-else class="log-output-container">
        <pre class="log-output"><code><template v-for="(line, idx) in parsedLines" :key="idx"><span :class="getLineClass(line)">{{ line.raw }}
</span></template></code></pre>
      </div>

      <div class="logs-footer">
        <span>{{ returnedLines }} of {{ totalLines }} lines</span>
        <span v-if="sseConnected" class="sse-status connected">SSE Connected</span>
        <span v-else class="sse-status disconnected">SSE Disconnected</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { logsApi } from '@/api/logs'
import { useAnalysisStore } from '@/stores/analysis'
import { storeToRefs } from 'pinia'

interface ParsedLine {
  raw: string
  level?: string
}

const analysisStore = useAnalysisStore()
const { connected: sseConnected } = storeToRefs(analysisStore)

const logs = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const totalLines = ref(0)
const returnedLines = ref(0)
const autoRefresh = ref(true)
const activeLevel = ref('ALL')

let refreshInterval: ReturnType<typeof setInterval> | null = null

const levels = [
  { key: 'ALL', label: 'All' },
  { key: 'INFO', label: 'Info' },
  { key: 'WARN', label: 'Warn' },
  { key: 'ERROR', label: 'Error' },
]

const parsedLines = computed<ParsedLine[]>(() => {
  if (!logs.value) return []
  return logs.value
    .split('\n')
    .filter(l => l.trim())
    .map(line => {
      const levelMatch = line.match(/\[(INFO|WARN|ERROR|DEBUG)\]/)
      return { raw: line, level: levelMatch ? levelMatch[1] : undefined }
    })
    .filter(line => {
      if (activeLevel.value === 'ALL') return true
      return line.level === activeLevel.value
    })
})

function getLineClass(line: ParsedLine): string {
  if (!line.level) return 'log-line'
  return `log-line level-${line.level.toLowerCase()}`
}

async function fetchLogs() {
  loading.value = true
  error.value = null
  try {
    const response = await logsApi.getLogs(500, activeLevel.value === 'ALL' ? undefined : activeLevel.value)
    logs.value = response.logs
    totalLines.value = response.totalLines
    returnedLines.value = response.returnedLines
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load logs'
  } finally {
    loading.value = false
  }
}

watch(autoRefresh, (enabled) => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
  if (enabled) {
    refreshInterval = setInterval(fetchLogs, 5000)
  }
})

onMounted(() => {
  fetchLogs()
  analysisStore.connectSSE()
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.logs-view {
  min-height: 100vh;
  background-color: var(--color-bg);
}

.logs-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.logs-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.level-filters {
  display: flex;
  gap: 4px;
}

.level-btn {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.level-btn:hover {
  background-color: var(--color-bg-secondary);
}

.level-btn.active {
  background-color: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.auto-refresh-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.refresh-btn {
  padding: 6px 16px;
  border-radius: var(--radius-md);
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 24px;
}

.error-message {
  color: var(--color-danger);
  margin-bottom: 16px;
}

.retry-button {
  padding: 8px 24px;
  background-color: var(--color-primary);
  color: white;
  border-radius: var(--radius-md);
  font-weight: 500;
}

.log-output-container {
  background-color: #1e1e1e;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: auto;
  max-height: calc(100vh - 250px);
}

.log-output {
  margin: 0;
  padding: 16px;
  font-family: var(--font-family-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: #d4d4d4;
}

.log-line { color: #d4d4d4; }
.level-info { color: #58a6ff; }
.level-warn { color: #d29922; }
.level-error { color: #f85149; }
.level-debug { color: #8b949e; }

.logs-footer {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.sse-status { font-weight: 500; }
.sse-status.connected { color: #3fb950; }
.sse-status.disconnected { color: #f85149; }
</style>
