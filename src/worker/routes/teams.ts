/**
 * Team API Routes
 * Handles team configuration, chat, and status endpoints
 */

import type { Express, Request, Response } from 'express';
import { createLogger } from '../../utils/logger';
import { TeamManager } from '../../teams/teamManager';
import { TeamConfigManager } from '../../teams/teamConfig';
import type { TeamName } from '../../teams/types';

const logger = createLogger('teams-routes');

let teamManager: TeamManager | null = null;

function getTeamManager(projectPath: string): TeamManager {
  if (!teamManager) {
    teamManager = new TeamManager(projectPath);
    teamManager.initialize().catch(err => {
      logger.error(`Failed to initialize TeamManager: ${err.message}`);
    });
  }
  return teamManager;
}

export function registerTeamRoutes(app: Express): void {
  /**
   * GET /api/teams - Get all team configurations
   */
  app.get('/api/teams', async (req: Request, res: Response) => {
    try {
      const projectPath = req.query.projectPath as string || process.cwd();
      const configManager = new TeamConfigManager(projectPath);

      const teams = [];
      for (const teamName of ['lead', 'dev', 'test'] as TeamName[]) {
        const config = await configManager.load(teamName);
        teams.push(config);
      }

      res.json(teams);
    } catch (error: any) {
      logger.error(`Failed to get teams: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/teams/:name - Get single team configuration
   */
  app.get('/api/teams/:name', async (req: Request, res: Response) => {
    try {
      const teamName = req.params.name as TeamName;
      const projectPath = req.query.projectPath as string || process.cwd();
      const configManager = new TeamConfigManager(projectPath);

      const config = await configManager.load(teamName);
      res.json(config);
    } catch (error: any) {
      logger.error(`Failed to get team ${req.params.name}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/teams/:name - Update team configuration
   */
  app.put('/api/teams/:name', async (req: Request, res: Response) => {
    try {
      const teamName = req.params.name as TeamName;
      const projectPath = req.body.projectPath || process.cwd();
      const configManager = new TeamConfigManager(projectPath);

      const existingConfig = await configManager.load(teamName);
      const updatedConfig = { ...existingConfig, ...req.body };

      await configManager.save(teamName, updatedConfig);

      res.json(updatedConfig);
    } catch (error: any) {
      logger.error(`Failed to update team ${req.params.name}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/teams/:name/status - Get team status
   */
  app.get('/api/teams/:name/status', async (req: Request, res: Response) => {
    try {
      const teamName = req.params.name as TeamName;
      const projectPath = req.query.projectPath as string || process.cwd();
      const manager = getTeamManager(projectPath);

      const status = manager.getTeamStatus(teamName);
      res.json(status);
    } catch (error: any) {
      logger.error(`Failed to get team status ${req.params.name}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/teams/status/all - Get all team statuses
   */
  app.get('/api/teams/status/all', async (req: Request, res: Response) => {
    try {
      const projectPath = req.query.projectPath as string || process.cwd();
      const manager = getTeamManager(projectPath);

      const statuses = manager.getAllStatuses();
      res.json(statuses);
    } catch (error: any) {
      logger.error(`Failed to get all team statuses: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/teams/:name/test - Test team API connectivity
   */
  app.post('/api/teams/:name/test', async (req: Request, res: Response) => {
    try {
      const teamName = req.params.name as TeamName;
      const projectPath = req.body.projectPath || process.cwd();
      const configManager = new TeamConfigManager(projectPath);

      // Try to load config
      const config = await configManager.load(teamName);

      res.json({
        success: true,
        team: teamName,
        model: config.model,
        message: 'Team configuration loaded successfully',
      });
    } catch (error: any) {
      logger.error(`Failed to test team ${req.params.name}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/teams/:name/abort - Abort team execution
   */
  app.post('/api/teams/:name/abort', async (req: Request, res: Response) => {
    try {
      const teamName = req.params.name as TeamName;
      const projectPath = req.body.projectPath || process.cwd();
      const manager = getTeamManager(projectPath);

      manager.abortTeam(teamName);

      res.json({ success: true, message: `Team ${teamName} aborted` });
    } catch (error: any) {
      logger.error(`Failed to abort team ${req.params.name}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/teams/abort-all - Abort all teams
   */
  app.post('/api/teams/abort-all', async (req: Request, res: Response) => {
    try {
      const projectPath = req.body.projectPath || process.cwd();
      const manager = getTeamManager(projectPath);

      manager.abortAll();

      res.json({ success: true, message: 'All teams aborted' });
    } catch (error: any) {
      logger.error(`Failed to abort all teams: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  logger.info('Team routes registered');
}
