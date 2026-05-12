import { apiClient, unwrap } from './client'

export interface Task {
  id: number
  project_id: string
  title: string
  description: string | null
  status: string
  priority: string
  estimated: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface Review {
  id: number
  project_id: string
  title: string
  severity: string
  location: string | null
  suggestion: string | null
  source: string
  status: string
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export const dashboardApi = {
  // Tasks
  async getTasks(projectName: string): Promise<{ tasks: Task[] }> {
    return unwrap(apiClient.get<{ tasks: Task[] }>(
      `/projects/${encodeURIComponent(projectName)}/tasks`
    ))
  },

  async createTask(projectName: string, task: {
    title: string
    description?: string
    status?: string
    priority?: string
    estimated?: string
  }): Promise<Task> {
    return unwrap(apiClient.post<Task>(
      `/projects/${encodeURIComponent(projectName)}/tasks`,
      task
    ))
  },

  async updateTask(projectName: string, taskId: number, updates: Partial<Task>): Promise<void> {
    await unwrap(apiClient.put(
      `/projects/${encodeURIComponent(projectName)}/tasks/${taskId}`,
      updates as Record<string, unknown>
    ))
  },

  async deleteTask(projectName: string, taskId: number): Promise<void> {
    await unwrap(apiClient.delete(
      `/projects/${encodeURIComponent(projectName)}/tasks/${taskId}`
    ))
  },

  // Reviews
  async getReviews(projectName: string): Promise<{ reviews: Review[] }> {
    return unwrap(apiClient.get<{ reviews: Review[] }>(
      `/projects/${encodeURIComponent(projectName)}/reviews`
    ))
  },

  async createReview(projectName: string, review: {
    title: string
    severity?: string
    location?: string
    suggestion?: string
    source?: string
  }): Promise<Review> {
    return unwrap(apiClient.post<Review>(
      `/projects/${encodeURIComponent(projectName)}/reviews`,
      review
    ))
  },

  async updateReview(projectName: string, reviewId: number, updates: Partial<Review>): Promise<void> {
    await unwrap(apiClient.put(
      `/projects/${encodeURIComponent(projectName)}/reviews/${reviewId}`,
      updates as Record<string, unknown>
    ))
  },

  async deleteReview(projectName: string, reviewId: number): Promise<void> {
    await unwrap(apiClient.delete(
      `/projects/${encodeURIComponent(projectName)}/reviews/${reviewId}`
    ))
  },

  async triggerScan(projectName: string): Promise<{ findingsCount: number }> {
    return unwrap(apiClient.post<{ findingsCount: number }>(
      `/projects/${encodeURIComponent(projectName)}/reviews/scan`
    ))
  },

  async fixReview(reviewId: number): Promise<{ explanation: string }> {
    return unwrap(apiClient.post<{ explanation: string }>(
      `/reviews/${reviewId}/fix`
    ))
  },
}
