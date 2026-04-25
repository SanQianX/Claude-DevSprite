import { apiClient } from './client'

export const analysisApi = {
  async getAnalysisStatus(projectName: string) {
    const response = await apiClient.get(`/projects/${projectName}/analysis-status`)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to fetch analysis status')
  },

  async triggerFullAnalysis(projectName: string) {
    const response = await apiClient.post(`/projects/${projectName}/analyze/full`, {})
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to trigger analysis')
  },
}
