import { apiClient } from './client'
import type {
  Project,
  ProjectDetail,
  FileTreeResponse,
  DocumentData,
  ApiResponse
} from '@/types'

export const projectsApi = {
  /**
   * GET /api/projects
   * Returns: { projects: Project[] }
   */
  async getProjects(): Promise<{ projects: Project[] }> {
    const response = await apiClient.get<{ projects: Project[] }>('/projects')
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to fetch projects')
  },

  /**
   * GET /api/projects/:name
   * Returns: { name, path, knowledgePath, description, lastUpdated, documentCount }
   */
  async getProjectDetail(projectName: string): Promise<ProjectDetail> {
    const response = await apiClient.get<ProjectDetail>(`/projects/${projectName}`)
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to fetch project detail')
  },

  /**
   * GET /api/projects/:name/tree
   * Returns: { projectName, tree: FileTreeNode }
   */
  async getProjectTree(projectName: string): Promise<FileTreeResponse> {
    const response = await apiClient.get<FileTreeResponse>(
      `/projects/${projectName}/tree`
    )
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to fetch file tree')
  },

  /**
   * GET /api/projects/:name/file?path=...
   * Returns: { path, title, content, meta }
   */
  async getProjectFile(
    projectName: string,
    path: string
  ): Promise<DocumentData> {
    const response = await apiClient.get<DocumentData>(
      `/projects/${projectName}/file?path=${encodeURIComponent(path)}`
    )
    if (response.success && response.data) {
      return response.data
    }
    throw new Error(response.error || 'Failed to fetch file content')
  }
}
