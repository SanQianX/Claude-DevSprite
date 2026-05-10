import { apiClient, unwrap } from './client'
import type {
  Project,
  ProjectDetail,
  FileTreeResponse,
  DocumentData
} from '@/types'

export interface FilesystemEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface BrowseResponse {
  currentPath: string
  parentPath: string | null
  entries: FilesystemEntry[]
}

export interface DriveInfo {
  letter: string
  label: string
  free: number
  total: number
}

export const projectsApi = {
  /**
   * GET /api/projects
   * Returns: { projects: Project[] }
   */
  async getProjects(): Promise<{ projects: Project[] }> {
    return unwrap(apiClient.get<{ projects: Project[] }>('/projects'))
  },

  /**
   * GET /api/projects/:name
   * Returns: { name, path, knowledgePath, description, lastUpdated, documentCount }
   */
  async getProjectDetail(projectName: string): Promise<ProjectDetail> {
    return unwrap(apiClient.get<ProjectDetail>(`/projects/${projectName}`))
  },

  /**
   * GET /api/projects/:name/tree
   * Returns: { projectName, tree: FileTreeNode }
   */
  async getProjectTree(projectName: string): Promise<FileTreeResponse> {
    return unwrap(apiClient.get<FileTreeResponse>(
      `/projects/${projectName}/tree`
    ))
  },

  /**
   * POST /api/projects/add
   * Manually add a project by path
   * Returns: Project
   */
  async addProject(projectPath: string): Promise<Project> {
    return unwrap(apiClient.post<Project>('/projects/add', { path: projectPath }))
  },

  /**
   * DELETE /api/projects/:name
   * Remove a project from the system (does NOT delete local files)
   */
  async deleteProject(projectName: string): Promise<void> {
    await unwrap(apiClient.delete(`/projects/${encodeURIComponent(projectName)}`))
  },

  /**
   * GET /api/projects/:name/file?path=...
   * Returns: { path, title, content, meta }
   */
  async getProjectFile(
    projectName: string,
    path: string
  ): Promise<DocumentData> {
    return unwrap(apiClient.get<DocumentData>(
      `/projects/${projectName}/file?path=${encodeURIComponent(path)}`
    ))
  },

  /**
   * GET /api/filesystem/drives
   * Get list of system disk drives
   * Returns: { drives: [{ letter, label, free, total }] }
   */
  async getDrives(): Promise<DriveInfo[]> {
    const data = await unwrap(apiClient.get<{ drives: DriveInfo[] }>('/filesystem/drives'))
    return data.drives
  },

  /**
   * GET /api/filesystem/browse?path=...
   * Browse local filesystem directories
   * Returns: { currentPath, parentPath, entries: [{ name, path, isDirectory }] }
   */
  async browseFilesystem(dirPath?: string): Promise<BrowseResponse> {
    const query = dirPath ? `?path=${encodeURIComponent(dirPath)}` : ''
    return unwrap(apiClient.get<BrowseResponse>(`/filesystem/browse${query}`))
  }
}
