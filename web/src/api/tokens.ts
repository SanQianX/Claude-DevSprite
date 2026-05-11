import { apiClient, unwrap } from './client'

export interface TokenStats {
  total: number
  input: number
  output: number
  cache: number
  cost: number
}

export interface DailyTokens {
  date: string
  input: number
  output: number
  cache: number
  total: number
  cost: number
  models: string[]
}

export interface TokensResponse {
  stats: TokenStats
  daily: DailyTokens[]
  trendDelta: number
  trendPercent: number
  period: string
  lastUpdated: string
}

export const tokensApi = {
  /**
   * GET /api/tokens?period=week
   * Returns token consumption stats for the given period
   */
  async getStats(period: string = 'week'): Promise<TokensResponse> {
    return unwrap(apiClient.get<TokensResponse>(`/tokens?period=${period}`))
  },

  /**
   * POST /api/tokens/refresh
   * Force refresh cached token data
   */
  async refresh(): Promise<{ success: boolean; message: string; data: TokensResponse }> {
    return unwrap(apiClient.post<{ success: boolean; message: string; data: TokensResponse }>('/tokens/refresh'))
  },

  /**
   * GET /api/tokens/status
   * Check ccusage availability
   */
  async status(): Promise<{ ccusageAvailable: boolean; cacheTTL: string }> {
    return unwrap(apiClient.get<{ ccusageAvailable: boolean; cacheTTL: string }>('/tokens/status'))
  }
}
