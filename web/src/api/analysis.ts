import { apiClient, unwrap } from './client'

export const analysisApi = {
  async getAnalysisStatus(projectName: string) {
    return unwrap(apiClient.get(`/projects/${projectName}/analysis-status`))
  },

  async triggerFullAnalysis(projectName: string) {
    return unwrap(apiClient.post(`/projects/${projectName}/analyze/full`, {}))
  },
}
