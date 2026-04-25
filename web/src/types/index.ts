/**
 * Frontend TypeScript Types
 * Matches backend API response formats
 */

// ========================================
// API Response Types
// ========================================

export interface ApiResponse<T = any> {
  success?: boolean
  data?: T
  error?: string
}

// ========================================
// Project Types (from /api/projects)
// ========================================

export interface Project {
  name: string
  path: string
  description?: string
  lastUpdated?: string
  documentCount: number
  color?: string
}

export interface ProjectDetail extends Project {
  knowledgePath: string
}

// ========================================
// File Tree Types (from /api/projects/:name/tree)
// ========================================

export interface FileTreeNode {
  name: string
  type: 'directory' | 'file'
  path: string
  children?: FileTreeNode[]
}

export interface FileTreeResponse {
  projectName: string
  tree: FileTreeNode[]
}

// ========================================
// Document Types (from /api/projects/:name/file)
// ========================================

export interface DocumentData {
  path: string
  title: string
  content: string
  meta: DocumentMeta
}

export interface DocumentMeta {
  category?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: any
}

// ========================================
// Source Code Types (from /api/projects/:name/source)
// ========================================

export interface SourceCodeData {
  path: string
  language: string
  totalLines: number
  content: string
  startLine: number
  endLine: number
}

// ========================================
// Search Types (from /api/search and /api/projects/:name/search)
// ========================================

export interface SearchResult {
  type: 'document' | 'source'
  path: string
  title: string
  snippet: string
  matches: number
  category?: string
  projectName?: string
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
}

// ========================================
// TOC Types (Frontend-generated)
// ========================================

export interface TocItem {
  id: string
  text: string
  level: number
}

// ========================================
// UI Component Types
// ========================================

export interface BreadcrumbItem {
  label: string
  to?: string
}

// ========================================
// Store State Types
// ========================================

export interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  loading: boolean
  error: string | null
}

export interface KnowledgeState {
  fileTree: FileTreeNode | null
  currentDocument: DocumentData | null
  toc: TocItem[]
  loading: boolean
  error: string | null
  expandedPaths: Set<string>
}

export interface SearchState {
  query: string
  results: SearchResult[]
  isSearching: boolean
  error: string | null
}

export interface UIState {
  sidebarOpen: boolean
  tocPanelOpen: boolean
  theme: 'light' | 'dark'
}
