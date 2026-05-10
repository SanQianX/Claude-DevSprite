import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dashboardApi } from '@/api/dashboard'
import type { Task, Review } from '@/api/dashboard'

export const useDashboardStore = defineStore('dashboard', () => {
  const tasks = ref<Task[]>([])
  const reviews = ref<Review[]>([])
  const loading = ref(false)

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

  async function approveReview(projectName: string, reviewId: number) {
    await dashboardApi.updateReview(projectName, reviewId, { status: 'approved' })
    reviews.value = reviews.value.filter(r => r.id !== reviewId)
  }

  async function ignoreReview(projectName: string, reviewId: number) {
    await dashboardApi.updateReview(projectName, reviewId, { status: 'ignored' })
    reviews.value = reviews.value.filter(r => r.id !== reviewId)
  }

  return {
    tasks,
    reviews,
    loading,
    fetchTasks,
    fetchReviews,
    fetchAll,
    addTask,
    updateTask,
    deleteTask,
    approveReview,
    ignoreReview,
  }
})
