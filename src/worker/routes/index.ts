/**
 * Routes Registry
 * Registers all API routes
 */

import type { Express } from 'express';
import { registerProjectRoutes } from './projects';
import { registerFileRoutes } from './files';
import { registerSearchRoutes } from './search';
import { registerGitRoutes } from './git';
import { registerAnalysisRoutes } from './analysis';
import { registerRelationRoutes } from './relations';
import { registerConfigRoutes } from './config';
import { registerInternalRoutes } from './internal';
import { registerLogRoutes } from './logs';
import { registerTeamRoutes } from './teams';
import { registerTokenRoutes } from './tokens';
import { registerDashboardRoutes } from './dashboard';

export function registerRoutes(app: Express): void {
  // Register route modules
  registerProjectRoutes(app);
  registerFileRoutes(app);
  registerSearchRoutes(app);
  registerGitRoutes(app);
  registerAnalysisRoutes(app);
  registerRelationRoutes(app);
  registerConfigRoutes(app);
  registerInternalRoutes(app);
  registerLogRoutes(app);
  registerTeamRoutes(app);
  registerTokenRoutes(app);
  registerDashboardRoutes(app);
}
