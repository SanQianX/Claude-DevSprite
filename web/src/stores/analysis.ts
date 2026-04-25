import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type AnalysisStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface AnalysisProgressState {
  status: AnalysisStatus
  projectName: string | null
  commitHash: string | null
  mode: string | null
  currentStep: string
  progress: number
  startedAt: number | null
  queueDepth: number
  lastError: string | null
  lastCompletedAt: number | null
}

const SSE_RECONNECT_DELAY = 3000

const initialState: AnalysisProgressState = {
  status: 'idle',
  projectName: null,
  commitHash: null,
  mode: null,
  currentStep: '',
  progress: 0,
  startedAt: null,
  queueDepth: 0,
  lastError: null,
  lastCompletedAt: null,
}

export const useAnalysisStore = defineStore('analysis', () => {
  const progress = ref<AnalysisProgressState>({ ...initialState })
  const connected = ref(false)
  const eventSource = ref<EventSource | null>(null)
  const reconnectTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

  const isRunning = computed(() => progress.value.status === 'running')
  const currentProject = computed(() => progress.value.projectName)

  const stepLabel = computed(() => {
    const stepMap: Record<string, string> = {
      'starting': 'Starting analysis...',
      'collecting_structure': 'Reading project structure...',
      'collecting_source_files': 'Scanning source files...',
      'collecting_knowledge': 'Loading existing knowledge...',
      'building_prompt': 'Building analysis prompt...',
      'calling_ai': 'Calling AI model...',
      'writing_documents': 'Writing documents...',
      'updating_database': 'Updating database...',
      'completed': 'Analysis complete',
      'failed': 'Analysis failed',
    }
    return stepMap[progress.value.currentStep] || progress.value.currentStep
  })

  function connectSSE() {
    if (eventSource.value) {
      eventSource.value.close()
    }

    const es = new EventSource('/api/stream')
    eventSource.value = es

    es.onopen = () => {
      connected.value = true
      if (reconnectTimeout.value) {
        clearTimeout(reconnectTimeout.value)
        reconnectTimeout.value = null
      }
    }

    es.onerror = () => {
      connected.value = false
      es.close()

      reconnectTimeout.value = setTimeout(() => {
        reconnectTimeout.value = null
        connectSSE()
      }, SSE_RECONNECT_DELAY)
    }

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'analysis_progress' || data.type === 'initial_state') {
          progress.value = {
            status: data.status || 'idle',
            projectName: data.projectName || null,
            commitHash: data.commitHash || null,
            mode: data.mode || null,
            currentStep: data.currentStep || '',
            progress: data.progress || 0,
            startedAt: data.startedAt || null,
            queueDepth: data.queueDepth || 0,
            lastError: data.lastError || null,
            lastCompletedAt: data.lastCompletedAt || null,
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  function disconnectSSE() {
    if (eventSource.value) {
      eventSource.value.close()
      eventSource.value = null
    }
    if (reconnectTimeout.value) {
      clearTimeout(reconnectTimeout.value)
      reconnectTimeout.value = null
    }
    connected.value = false
  }

  return {
    progress,
    connected,
    isRunning,
    currentProject,
    stepLabel,
    connectSSE,
    disconnectSSE,
  }
})
