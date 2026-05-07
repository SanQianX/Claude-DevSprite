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
  ai?: {
    model: string
    baseUrl: string
    hasApiKey: boolean
    maskedApiKey: string
    maxRetries: number
  }
  dbPath?: string
}

export interface AIConfigPayload {
  model?: string
  baseUrl?: string
  apiKey?: string
  maxRetries?: number
}

export interface AITestResult {
  success: boolean
  message: string
  latency?: number
  model?: string
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

  /**
   * POST /api/config/ai
   * Save AI provider configuration (model, baseUrl, apiKey, maxRetries)
   */
  async saveAI(payload: AIConfigPayload): Promise<{ status: string; message: string; ai: any }> {
    return apiCall('/config/ai', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  /**
   * POST /api/config/ai-test
   * Test AI connection by making a real API call
   */
  async testAI(payload?: AIConfigPayload): Promise<AITestResult> {
    return apiCall('/config/ai-test', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    })
  },
}
