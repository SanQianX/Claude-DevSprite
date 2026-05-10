import { apiClient, unwrap } from './client'

export interface TokenStats {
  total: number
  input: number
  output: number
  cache: number
}

export interface DailyTokens {
  date: string
  input: number
  output: number
}

export interface TokensResponse {
  stats: TokenStats
  weekly: DailyTokens[]
  trendDelta: number
  trendPercent: number
}

export const tokensApi = {
  /**
   * GET /api/tokens?period=week
   * Returns token consumption stats for the given period
   */
  async getStats(period: string = 'week'): Promise<TokensResponse> {
    return unwrap(apiClient.get<TokensResponse>(`/tokens?period=${period}`))
  },
}
