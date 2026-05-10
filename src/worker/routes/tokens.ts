/**
 * Tokens API Routes
 * GET /api/tokens - Return token consumption statistics
 */

import type { Express, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Generate mock token data based on period.
 * In future, this will be backed by real usage tracking from the analysis pipeline.
 */
function getTokenData(period: string) {
  const now = new Date()
  const stats = { total: 1284567, input: 823412, output: 461155, cache: 128456 }

  // Generate 7 days of weekly data
  const weekly = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    // Simulate varying daily usage
    const base = 50000 + Math.floor(Math.random() * 100000)
    const inputRatio = 0.6 + Math.random() * 0.1
    weekly.push({
      date: dateStr,
      input: Math.floor(base * inputRatio),
      output: Math.floor(base * (1 - inputRatio)),
    })
  }

  // Trend: compare last 7 days vs previous 7 days
  const currentWeekTotal = weekly.reduce((s, d) => s + d.input + d.output, 0)
  const prevWeekTotal = currentWeekTotal * (0.85 + Math.random() * 0.1)
  const trendDelta = currentWeekTotal - Math.floor(prevWeekTotal)
  const trendPercent = prevWeekTotal > 0
    ? Math.round((trendDelta / prevWeekTotal) * 100)
    : 0

  // Adjust stats based on period
  let periodStats = { ...stats }
  if (period === 'day') {
    periodStats = {
      total: Math.floor(stats.total * 0.05),
      input: Math.floor(stats.input * 0.05),
      output: Math.floor(stats.output * 0.05),
      cache: Math.floor(stats.cache * 0.05),
    }
  } else if (period === 'month') {
    periodStats = {
      total: stats.total * 4,
      input: stats.input * 4,
      output: stats.output * 4,
      cache: stats.cache * 4,
    }
  } else if (period === 'all') {
    periodStats = {
      total: stats.total * 12,
      input: stats.input * 12,
      output: stats.output * 12,
      cache: stats.cache * 12,
    }
  }

  return {
    stats: periodStats,
    weekly,
    trendDelta,
    trendPercent,
  }
}

export function registerTokenRoutes(app: Express): void {
  /**
   * GET /api/tokens
   * Query params:
   *  - period: day | week | month | all (default: week)
   */
  app.get('/api/tokens', asyncHandler(async (req: Request, res: Response) => {
    const period = (req.query.period as string) || 'week'
    const data = getTokenData(period)
    res.json(data)
  }))
}
