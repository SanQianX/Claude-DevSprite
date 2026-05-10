import { apiClient, unwrap } from './client'
import type { SourceCodeData } from '@/types'

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
    return unwrap(apiClient.get<SourceCodeData>(
      `/projects/${projectName}/source?${params.toString()}`
    ))
  }
}
