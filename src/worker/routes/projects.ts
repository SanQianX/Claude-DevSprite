/**
 * Projects API Routes
 * GET /api/projects
 * GET /api/projects/:name
 */

import type { Express, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config';
import { createError } from '../middleware/errorHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('projects');

export interface ProjectInfo {
  name: string;
  path: string;
  description?: string;
  lastUpdated?: string;
  documentCount: number;
}

export function registerProjectRoutes(app: Express): void {
  /**
   * GET /api/projects
   * Get all projects - scan knowledge root for directories containing knowledge/ folder
   */
  app.get('/api/projects', (req: Request, res: Response) => {
    try {
      const projects: ProjectInfo[] = [];

      // Check if knowledge root exists
      if (!fs.existsSync(config.knowledgeRoot)) {
        logger.warn(`Knowledge root not found: ${config.knowledgeRoot}`);
        res.json({ projects: [] });
        return;
      }

      // Read all directories in knowledge root
      const entries = fs.readdirSync(config.knowledgeRoot, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = path.join(config.knowledgeRoot, entry.name);
          const knowledgePath = path.join(projectPath, 'knowledge');

          // Check if it contains knowledge directory
          if (fs.existsSync(knowledgePath) && fs.statSync(knowledgePath).isDirectory()) {
            // Count markdown files
            const documentCount = countMarkdownFiles(knowledgePath);
            const lastUpdated = getLastUpdatedDate(knowledgePath);

            projects.push({
              name: entry.name,
              path: projectPath,
              description: '', // Could be read from README.md if exists
              lastUpdated,
              documentCount
            });
          }
        }
      }

      // Sort by name
      projects.sort((a, b) => a.name.localeCompare(b.name));

      res.json({ projects });
    } catch (error) {
      logger.error('Error scanning projects', error);
      throw createError('Failed to scan projects', 500, error);
    }
  });

  /**
   * GET /api/projects/:name
   * Get project details
   */
  app.get('/api/projects/:name', (req: Request, res: Response) => {
    const { name } = req.params;

    try {
      const projectPath = path.join(config.knowledgeRoot, name);
      const knowledgePath = path.join(projectPath, 'knowledge');

      if (!fs.existsSync(projectPath)) {
        throw createError('Project not found', 404);
      }

      const documentCount = countMarkdownFiles(knowledgePath);
      const lastUpdated = getLastUpdatedDate(knowledgePath);

      res.json({
        name,
        path: projectPath,
        knowledgePath,
        description: '',
        lastUpdated,
        documentCount
      });
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      logger.error('Error getting project details', error);
      throw createError('Failed to get project details', 500, error);
    }
  });
}

function countMarkdownFiles(dirPath: string): number {
  let count = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        count += countMarkdownFiles(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        count++;
      }
    }
  } catch (error) {
    // Ignore errors for directories we can't read
  }

  return count;
}

function getLastUpdatedDate(dirPath: string): string {
  let latest = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const stats = fs.statSync(fullPath);

      if (entry.isDirectory()) {
        const dirLatest = getLastUpdatedDate(fullPath);
        const dirTimestamp = new Date(dirLatest).getTime();
        if (dirTimestamp > latest) {
          latest = dirTimestamp;
        }
      } else if (entry.isFile()) {
        if (stats.mtime.getTime() > latest) {
          latest = stats.mtime.getTime();
        }
      }
    }
  } catch (error) {
    // Ignore errors for directories we can't read
  }

  return latest > 0 ? new Date(latest).toISOString() : new Date().toISOString();
}
