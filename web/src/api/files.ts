import { apiClient } from './client'
import type { SourceCodeData, ApiResponse } from '@/types'

export const filesApi = {
  /**
   * GET /api/projects/:name/source?path=...&start=...&end=...
   * Returns: { path, language, totalLines, content, startLine, endLine }
   */
  async getSourceCode(
    projectName: string,
    path: string,
    start: number = 1,
    end?: number
  ): Promise<SourceCodeData> {
    const params = new URLSearchParams({
      path,
      start: start.toString()
    })
    if (end && end > 0) {
      params.append('end', end.toString())
    }
    const response = await apiClient.get<SourceCodeData>(
      `/projects/${projectName}/source?${params.toString()}`
    )
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to fetch source code')
  }
}
