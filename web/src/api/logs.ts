import { apiClient } from './client'

export interface LogsResponse {
  logs: string
  totalLines: number
  returnedLines: number
  level: string
}

export const logsApi = {
  async getLogs(lines: number = 500, level?: string): Promise<LogsResponse> {
    const params = new URLSearchParams({ lines: String(lines) })
    if (level && level !== 'ALL') {
      params.set('level', level)
    }
    const response = await apiClient.get(`/logs?${params}`)
    if (response.success && response.data) {
      return response.data as LogsResponse
    }
    throw new Error(response.error || 'Failed to fetch logs')
  },
}
