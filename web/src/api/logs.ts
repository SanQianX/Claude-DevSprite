import { apiClient, unwrap } from './client'

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
    return unwrap(apiClient.get<LogsResponse>(`/logs?${params}`))
  },
}
