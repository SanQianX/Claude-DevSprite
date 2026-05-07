import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logsApi } from '@/api/logs'

export interface ParsedLogLine {
  timestamp: string
  level: string
  prefix: string
  message: string
  raw: string
}

const LOG_REGEX = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]\s*\[(\w+)\]\s*\[([^\]]*)\]\s*(.*)$/

function parseLogs(raw: string): ParsedLogLine[] {
  return raw.split('\n').filter(Boolean).map(line => {
    const match = line.match(LOG_REGEX)
    if (match) {
      return {
        timestamp: match[1],
        level: match[2].toUpperCase(),
        prefix: match[3],
        message: match[4],
        raw: line,
      }
    }
    return { timestamp: '', level: 'INFO', prefix: '', message: line, raw: line }
  })
}

export const useLogsStore = defineStore('logs', () => {
  const logs = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalLines = ref(0)
  const returnedLines = ref(0)
  const activeLevel = ref('ALL')
  const autoRefresh = ref(true)
  const consoleOpen = ref(false)
  const consoleHeight = ref(
    parseInt(localStorage.getItem('consoleHeight') || '250', 10)
  )
  const newMessageCount = ref(0)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  const parsedLines = computed(() => parseLogs(logs.value))

  const filteredLines = computed(() => {
    let lines = parsedLines.value
    if (activeLevel.value !== 'ALL') {
      lines = lines.filter(l => l.level === activeLevel.value)
    }
    return lines
  })

  async function fetchLogs() {
    loading.value = true
    error.value = null
    try {
      const level = activeLevel.value === 'ALL' ? undefined : activeLevel.value
      const res = await logsApi.getLogs(500, level)
      const oldCount = logs.value ? logs.value.split('\n').filter(Boolean).length : 0
      logs.value = res.logs
      totalLines.value = res.totalLines
      returnedLines.value = res.returnedLines
      const newCount = logs.value.split('\n').filter(Boolean).length
      if (!consoleOpen.value && newCount > oldCount) {
        newMessageCount.value += newCount - oldCount
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch logs'
    } finally {
      loading.value = false
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh()
    autoRefresh.value = true
    fetchLogs()
    pollTimer = setInterval(fetchLogs, 5000)
  }

  function stopAutoRefresh() {
    autoRefresh.value = false
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function toggleConsole() {
    consoleOpen.value = !consoleOpen.value
    if (consoleOpen.value) {
      newMessageCount.value = 0
      if (!pollTimer) startAutoRefresh()
    }
  }

  function setConsoleHeight(h: number) {
    consoleHeight.value = h
    localStorage.setItem('consoleHeight', String(h))
  }

  return {
    logs,
    loading,
    error,
    totalLines,
    returnedLines,
    activeLevel,
    autoRefresh,
    consoleOpen,
    consoleHeight,
    newMessageCount,
    parsedLines,
    filteredLines,
    fetchLogs,
    startAutoRefresh,
    stopAutoRefresh,
    toggleConsole,
    setConsoleHeight,
  }
})
