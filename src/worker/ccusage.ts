/**
 * ccusage Integration Service
 * Calls ccusage CLI to get real token consumption data
 * Includes in-memory cache with configurable TTL
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry<T> {
  data: T
  timestamp: number
}

// In-memory cache
const cache = new Map<string, CacheEntry<unknown>>()

/**
 * Get cached data or fetch fresh data
 */
async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  const now = Date.now()

  // Return cached data if still fresh
  if (entry && now - entry.timestamp < CACHE_TTL_MS) {
    return entry.data
  }

  // Fetch fresh data
  const data = await fetcher()
  cache.set(key, { data, timestamp: now })
  return data
}

/**
 * Execute ccusage CLI command and parse JSON output
 */
async function executeCcusage(
  command: string,
  args: string[] = []
): Promise<Record<string, unknown>> {
  const fullArgs = [...args, '--json', '--offline'].join(' ')
  const cmd = `ccusage ${command} ${fullArgs}`

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 30000, // 30s timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    })

    if (stderr && !stderr.includes('Warning')) {
      console.error(`ccusage stderr: ${stderr}`)
    }

    return JSON.parse(stdout) as Record<string, unknown>
  } catch (error) {
    console.error(`ccusage execution failed: ${error}`)
    throw error
  }
}

/**
 * Map ccusage daily output to our frontend format
 */
interface CcusageItem {
  date?: string
  week?: string
  month?: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  totalTokens: number
  totalCost: number
  modelsUsed: string[]
}

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

/**
 * Aggregate stats from an array of items
 */
function aggregateStats<T extends {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  totalTokens: number
  totalCost: number
}>(items: T[]): TokenStats {
  const stats: TokenStats = {
    total: 0,
    input: 0,
    output: 0,
    cache: 0,
    cost: 0
  }

  for (const item of items) {
    stats.total += item.totalTokens
    stats.input += item.inputTokens
    stats.output += item.outputTokens
    stats.cache += item.cacheReadTokens + item.cacheCreationTokens
    stats.cost += item.totalCost
  }

  return stats
}

/**
 * Map ccusage items to DailyTokens format
 */
function mapToDailyTokens(items: CcusageItem[]): DailyTokens[] {
  return items.map(item => ({
    date: item.date || item.week || item.month || 'unknown',
    input: item.inputTokens,
    output: item.outputTokens,
    cache: item.cacheReadTokens + item.cacheCreationTokens,
    total: item.totalTokens,
    cost: item.totalCost,
    models: item.modelsUsed
  }))
}

/**
 * Calculate trend (compare current period vs previous period)
 */
function calculateTrend(
  currentStats: TokenStats,
  previousStats: TokenStats
): { delta: number; percent: number } {
  const delta = currentStats.total - previousStats.total
  const percent = previousStats.total > 0
    ? Math.round((delta / previousStats.total) * 100)
    : 0
  return { delta, percent }
}

/**
 * Get date range for "since" parameter based on period
 */
function getSinceDate(period: string): string {
  const now = new Date()
  let daysBack = 7

  switch (period) {
    case 'day':
      daysBack = 1
      break
    case 'week':
      daysBack = 7
      break
    case 'month':
      daysBack = 30
      break
    case 'all':
      daysBack = 365
      break
  }

  const since = new Date(now)
  since.setDate(since.getDate() - daysBack)
  return since.toISOString().slice(0, 10).replace(/-/g, '')
}

/**
 * Get tokens data for a specific period
 */
export async function getTokensData(period: string = 'week'): Promise<TokensResponse> {
  const cacheKey = `tokens-${period}`

  return getCachedOrFetch(cacheKey, async () => {
    const since = getSinceDate(period)

    // Fetch daily data for the period
    const dailyResult = await executeCcusage('daily', ['-s', since])
    const dailyItems = (dailyResult.daily || []) as CcusageItem[]

    // Calculate stats
    const stats = aggregateStats(dailyItems)

    // Calculate trend (compare first half vs second half)
    const mid = Math.floor(dailyItems.length / 2)
    const firstHalf = dailyItems.slice(0, mid)
    const secondHalf = dailyItems.slice(mid)
    const firstStats = aggregateStats(firstHalf)
    const secondStats = aggregateStats(secondHalf)
    const { delta, percent } = calculateTrend(secondStats, firstStats)

    // Map to frontend format
    const daily = mapToDailyTokens(dailyItems)

    return {
      stats,
      daily,
      trendDelta: delta,
      trendPercent: percent,
      period,
      lastUpdated: new Date().toISOString()
    }
  })
}

/**
 * Get weekly summary data
 */
export async function getWeeklyData(): Promise<TokensResponse> {
  const cacheKey = 'tokens-weekly'

  return getCachedOrFetch(cacheKey, async () => {
    const result = await executeCcusage('weekly')
    const weeklyItems = (result.weekly || []) as CcusageItem[]

    const stats = aggregateStats(weeklyItems)
    const daily = mapToDailyTokens(weeklyItems)

    return {
      stats,
      daily,
      trendDelta: 0,
      trendPercent: 0,
      period: 'weekly',
      lastUpdated: new Date().toISOString()
    }
  })
}

/**
 * Get monthly summary data
 */
export async function getMonthlyData(): Promise<TokensResponse> {
  const cacheKey = 'tokens-monthly'

  return getCachedOrFetch(cacheKey, async () => {
    const result = await executeCcusage('monthly')
    const monthlyItems = (result.monthly || []) as CcusageItem[]

    const stats = aggregateStats(monthlyItems)
    const daily = mapToDailyTokens(monthlyItems)

    return {
      stats,
      daily,
      trendDelta: 0,
      trendPercent: 0,
      period: 'monthly',
      lastUpdated: new Date().toISOString()
    }
  })
}

/**
 * Force refresh cache (called by refresh endpoint)
 */
export function clearCache(pattern?: string): void {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.startsWith(pattern)) {
        cache.delete(key)
      }
    }
  } else {
    cache.clear()
  }
}

/**
 * Check if ccusage is available
 */
export async function checkCcusageAvailable(): Promise<boolean> {
  try {
    await execAsync('ccusage --version', { timeout: 5000 })
    return true
  } catch {
    return false
  }
}
