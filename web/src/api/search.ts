import { apiClient, unwrap } from './client'
import type { SearchResponse } from '@/types'

export const searchApi = {
  /**
   * GET /api/projects/:name/search?q=...
   * Returns: { projectName, query, results: SearchResult[] }
   */
  async searchProject(
    projectName: string,
    query: string
  ): Promise<SearchResponse> {
    return unwrap(apiClient.get<SearchResponse>(
      `/projects/${projectName}/search?q=${encodeURIComponent(query)}`
    ))
  },

  /**
   * GET /api/search?q=...
   * Returns: { query, results: SearchResult[] } (with projectName added to each result)
   */
  async searchAllProjects(query: string): Promise<SearchResponse> {
    return unwrap(apiClient.get<SearchResponse>(
      `/search?q=${encodeURIComponent(query)}`
    ))
  }
}
