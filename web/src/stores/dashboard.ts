import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dashboardApi } from '@/api/dashboard'
import type { Task, Review } from '@/api/dashboard'

export const useDashboardStore = defineStore('dashboard', () => {
  const tasks = ref<Task[]>([])
  const reviews = ref<Review[]>([])
  const loading = ref(false)
  const scannerConfig = ref<{ enabled: boolean; intervalMs: number; isScanning: boolean }>({
    enabled: true,
    intervalMs: 10 * 60 * 1000,
    isScanning: false,
  })

  const scannerStatus = ref<{
    activeProjects: Array<{ projectId: string; projectName: string; scanDir: string; startedAt: number }>;
    lastScanTime: number | null;
  }>({
    activeProjects: [],
    lastScanTime: null,
  })

  const fixerConfig = ref<{
    enabled: boolean; intervalMs: number; isFixing: boolean;
    currentFixDir: string | null; currentFixIndex: number; totalFixes: number;
  }>({
    enabled: false,
    intervalMs: 30 * 60 * 1000,
    isFixing: false,
    currentFixDir: null,
    currentFixIndex: 0,
    totalFixes: 0,
  })

  async function fetchTasks(projectName: string) {
    try {
      const { tasks: t } = await dashboardApi.getTasks(projectName)
      tasks.value = t
    } catch {
      tasks.value = []
    }
  }

  async function fetchReviews(projectName: string) {
    try {
      const { reviews: r } = await dashboardApi.getReviews(projectName)
      reviews.value = r
    } catch {
      reviews.value = []
    }
  }

  async function fetchAll(projectName: string) {
    loading.value = true
    await Promise.all([fetchTasks(projectName), fetchReviews(projectName)])
    loading.value = false
  }

  async function addTask(projectName: string, task: {
    title: string
    description?: string
    status?: string
    priority?: string
    estimated?: string
  }) {
    const newTask = await dashboardApi.createTask(projectName, task)
    tasks.value.unshift(newTask)
    return newTask
  }

  async function updateTask(projectName: string, taskId: number, updates: Partial<Task>) {
    await dashboardApi.updateTask(projectName, taskId, updates)
    const idx = tasks.value.findIndex(t => t.id === taskId)
    if (idx !== -1) {
      tasks.value[idx] = { ...tasks.value[idx], ...updates }
    }
  }

  async function deleteTask(projectName: string, taskId: number) {
    await dashboardApi.deleteTask(projectName, taskId)
    tasks.value = tasks.value.filter(t => t.id !== taskId)
  }

  async function fixReview(projectName: string, reviewId: number) {
    const result = await dashboardApi.fixReview(reviewId)
    const review = reviews.value.find(r => r.id === reviewId)
    if (review) {
      // Backend may return 'fixed' or 'confirmed' depending on review type
      review.status = result.action === 'confirmed' ? 'confirmed' : 'fixed'
      review.resolved_at = new Date().toISOString()
    }
    // Refresh tasks to sync stats (review fix may create/update tasks)
    await fetchTasks(projectName)
    return result
  }

  async function triggerScan(projectName: string) {
    const result = await dashboardApi.triggerScan(projectName)
    await fetchReviews(projectName)
    return result
  }

  async function batchFixReviews(projectName: string, reviewIds?: number[]) {
    const result = await dashboardApi.batchFixReviews(projectName, reviewIds)
    await fetchReviews(projectName)
    await fetchTasks(projectName)
    return result
  }

  async function ignoreReview(projectName: string, reviewId: number) {
    await dashboardApi.updateReview(projectName, reviewId, { status: 'ignored' })
    // 更新状态而不是删除，这样筛选器和统计才能正确工作
    const review = reviews.value.find(r => r.id === reviewId)
    if (review) {
      review.status = 'ignored'
      review.resolved_at = new Date().toISOString()
    }
    await fetchTasks(projectName)
  }

  async function fetchScannerConfig() {
    try {
      const config = await dashboardApi.getScannerConfig()
      scannerConfig.value = config
    } catch {
      // keep defaults
    }
  }

  async function fetchScannerStatus() {
    try {
      const status = await dashboardApi.getScannerStatus()
      scannerStatus.value = {
        activeProjects: status.activeProjects || [],
        lastScanTime: status.lastScanTime,
      }
      // Also update config from status
      scannerConfig.value = {
        enabled: status.enabled,
        intervalMs: status.intervalMs,
        isScanning: status.isScanning,
      }
    } catch {
      // keep defaults
    }
  }

  async function updateScannerConfig(config: { enabled?: boolean; intervalMs?: number }) {
    const result = await dashboardApi.updateScannerConfig(config)
    scannerConfig.value = result.config
    return result.config
  }

  async function fetchFixerConfig() {
    try {
      const config = await dashboardApi.getFixerConfig()
      fixerConfig.value = config
    } catch {
      // keep defaults
    }
  }

  async function updateFixerConfig(config: { enabled?: boolean; intervalMs?: number }) {
    const result = await dashboardApi.updateFixerConfig(config)
    fixerConfig.value = result.config
    return result.config
  }

  return {
    tasks,
    reviews,
    loading,
    scannerConfig,
    scannerStatus,
    fixerConfig,
    fetchTasks,
    fetchReviews,
    fetchAll,
    addTask,
    updateTask,
    deleteTask,
    ignoreReview,
    fixReview,
    triggerScan,
    batchFixReviews,
    fetchScannerConfig,
    fetchScannerStatus,
    updateScannerConfig,
    fetchFixerConfig,
    updateFixerConfig,
  }
})
