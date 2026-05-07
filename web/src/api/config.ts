/**
 * Config API Client
 */

const API_BASE = '/api'

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || error.message || 'API call failed')
  }
  return response.json()
}

export interface SystemConfig {
  server?: { port: number; host: string }
  knowledge?: { directoryName: string; autoCommit: boolean }
  analysis?: {
    mode: string
    fullAnalysisIntervalDays: number
    diffMaxTokens: number
    maxRetries: number
  }
  detection?: {
    preferredStrategy: string
    pollerIntervalMs: number
  }
  web?: { enabled: boolean; autoOpen: boolean }
  logging?: { level: string }
  projectDiscovery?: {
    knowledgeDirName: string
    autoDiscover: boolean
    maxDepth: number
    scanPaths: string[]
  }
  dbPath?: string
}

export const configApi = {
  async get(): Promise<SystemConfig> {
    return apiCall('/config')
  },

  async patch(updates: Partial<SystemConfig>): Promise<{ status: string; message: string }> {
    return apiCall('/config', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  },
}
