import { apiClient } from './client'
import type { SearchResponse, SearchResult, ApiResponse } from '@/types'

export const searchApi = {
  /**
   * GET /api/projects/:name/search?q=...
   * Returns: { projectName, query, results: SearchResult[] }
   */
  async searchProject(
    projectName: string,
    query: string
  ): Promise<SearchResponse> {
    const response = await apiClient.get<SearchResponse>(
      `/projects/${projectName}/search?q=${encodeURIComponent(query)}`
    )
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Search failed')
  },

  /**
   * GET /api/search?q=...
   * Returns: { query, results: SearchResult[] } (with projectName added to each result)
   */
  async searchAllProjects(query: string): Promise<SearchResponse> {
    const response = await apiClient.get<SearchResponse>(
      `/search?q=${encodeURIComponent(query)}`
    )
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Search failed')
  }
}
