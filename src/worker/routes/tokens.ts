/**
 * Tokens API Routes
 * GET /api/tokens - Return real token consumption statistics via ccusage
 * POST /api/tokens/refresh - Force refresh cached data
 */

import type { Express, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getTokensData,
  getWeeklyData,
  getMonthlyData,
  clearCache,
  checkCcusageAvailable
} from '../ccusage';

export function registerTokenRoutes(app: Express): void {
  /**
   * GET /api/tokens
   * GET /api/tokens/stats (alias)
   * Query params:
   *  - period: day | week | month | all (default: week)
   */
  const handler = asyncHandler(async (req: Request, res: Response) => {
    const period = (req.query.period as string) || 'week'

    let data
    switch (period) {
      case 'weekly':
        data = await getWeeklyData()
        break
      case 'monthly':
        data = await getMonthlyData()
        break
      default:
        data = await getTokensData(period)
    }

    res.json(data)
  })

  app.get('/api/tokens', handler)
  app.get('/api/tokens/stats', handler)

  /**
   * POST /api/tokens/refresh
   * Force refresh cached token data
   */
  app.post('/api/tokens/refresh', asyncHandler(async (_req: Request, res: Response) => {
    clearCache()
    const data = await getTokensData('week')
    res.json({
      success: true,
      message: 'Cache cleared and data refreshed',
      data
    })
  }))

  /**
   * GET /api/tokens/status
   * Check ccusage availability
   */
  app.get('/api/tokens/status', asyncHandler(async (_req: Request, res: Response) => {
    const available = await checkCcusageAvailable()
    res.json({
      ccusageAvailable: available,
      cacheTTL: '5 minutes'
    })
  }))
}
