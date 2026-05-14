/**
 * Projects API Routes
 * GET /api/projects
 * GET /api/projects/:name
 * POST /api/projects/discover
 * POST /api/projects/add
 * DELETE /api/projects/:name
 * GET /api/filesystem/browse
 * GET /api/filesystem/drives
 */

import type { Express, Request, Response } from 'express';
import { getProjectDiscoveryService } from '../../services/projectDiscovery';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { createLogger } from '../../utils/logger';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const logger = createLogger('projects');

interface DriveInfo {
  letter: string;
  label: string;
  free: number;
  total: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  knowledgePath: string;
  description?: string;
  lastAnalysisCommit?: string;
  lastFullAnalysis?: Date;
  analysisCount: number;
  createdAt: Date;
  updatedAt: Date;
  documentCount?: number;
  lastUpdated?: string;
  color?: string;
}

export function registerProjectRoutes(app: Express): void {
  /**
   * GET /api/projects
   * Get all projects
   */
  app.get('/api/projects', asyncHandler(async (req: Request, res: Response) => {
    try {
      const projectDiscovery = getProjectDiscoveryService();
      const projects = await projectDiscovery.getAllProjects();
      res.json({ projects });
    } catch (error) {
      logger.error('Error getting projects', error);
      throw createError('Failed to get projects', 500, error);
    }
  }));

  /**
   * GET /api/projects/:name
   * Get project details
   */
  app.get('/api/projects/:name', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    try {
      const projectDiscovery = getProjectDiscoveryService();
      const project = await projectDiscovery.getProject(name);

      if (!project) {
        throw createError('Project not found', 404);
      }

      res.json(project);
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting project details', error);
      throw createError('Failed to get project details', 500, error);
    }
  }));

  /**
   * POST /api/projects/discover
   * Scan for and discover all projects
   */
  app.post('/api/projects/discover', asyncHandler(async (req: Request, res: Response) => {
    try {
      const projectDiscovery = getProjectDiscoveryService();
      const discoveredProjects = await projectDiscovery.discoverProjects();

      const projects = await projectDiscovery.getAllProjects();

      res.json({
        discovered: discoveredProjects.length,
        total: projects.length,
        projects,
      });
    } catch (error) {
      logger.error('Error discovering projects', error);
      throw createError('Failed to discover projects', 500, error);
    }
  }));

  /**
   * POST /api/projects/add
   * Manually add a project
   */
  app.post('/api/projects/add', asyncHandler(async (req: Request, res: Response) => {
    const { path: projectPath } = req.body;

    if (!projectPath) {
      throw createError('Project path is required', 400);
    }

    try {
      const projectDiscovery = getProjectDiscoveryService();
      const project = await projectDiscovery.addProject(projectPath);

      // Create .claude-devsprite/scanteaks/ directory for agent scanner
      const scanteaksDir = path.join(projectPath, '.claude-devsprite', 'scanteaks');
      try {
        fs.mkdirSync(scanteaksDir, { recursive: true });
      } catch {
        // Directory may already exist or path may be invalid — non-fatal
      }

      // Create .claude-devsprite/fixtasks/ directory for agent fixer
      const fixtasksDir = path.join(projectPath, '.claude-devsprite', 'fixtasks');
      try {
        fs.mkdirSync(fixtasksDir, { recursive: true });
      } catch {
        // Directory may already exist or path may be invalid — non-fatal
      }

      res.json(project);
    } catch (error) {
      logger.error('Error adding project', error);
      throw createError('Failed to add project', 500, error);
    }
  }));

  /**
   * DELETE /api/projects/:name
   * Remove a project from the system (does NOT delete local files)
   */
  app.delete('/api/projects/:name', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    try {
      const projectDiscovery = getProjectDiscoveryService();
      await projectDiscovery.removeProject(name);

      res.json({ success: true, message: `Project "${name}" removed from system` });
    } catch (error) {
      logger.error('Error removing project', error);
      const message = error instanceof Error ? error.message : 'Failed to remove project';
      throw createError(message, error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500, error);
    }
  }));

  /**
   * GET /api/filesystem/drives
   * Get list of system disk drives
   * Returns: { drives: [{ letter, label, free, total }] }
   */
  app.get('/api/filesystem/drives', asyncHandler(async (req: Request, res: Response) => {
    try {
      const drives = await getSystemDrives();
      res.json({ drives });
    } catch (error) {
      logger.error('Error getting system drives', error);
      throw createError('Failed to get system drives', 500, error);
    }
  }));

  /**
   * GET /api/filesystem/browse
   * Browse local filesystem directories
   * Query params: path (optional) - directory to browse, defaults to user home
   * Returns: { currentPath, parentPath, entries: [{ name, path, isDirectory }] }
   */
  app.get('/api/filesystem/browse', asyncHandler(async (req: Request, res: Response) => {
    const requestedPath = req.query.path as string || os.homedir();

    try {
      // Resolve to absolute path
      const absolutePath = path.resolve(requestedPath);

      // Read directory contents (async, handles ENOENT naturally)
      const entries = await fsPromises.readdir(absolutePath, { withFileTypes: true });

      // Filter and map entries - only show directories for project selection
      const directoryEntries = entries
        .filter(entry => entry.isDirectory())
        .filter(entry => !entry.name.startsWith('.')) // Hide hidden directories
        .map(entry => ({
          name: entry.name,
          path: path.join(absolutePath, entry.name),
          isDirectory: true
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // Get parent directory
      const parentPath = path.dirname(absolutePath);

      res.json({
        currentPath: absolutePath,
        parentPath: parentPath !== absolutePath ? parentPath : null,
        entries: directoryEntries
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        throw createError('Directory does not exist', 404);
      }
      if (nodeError.code === 'ENOTDIR') {
        throw createError('Path is not a directory', 400);
      }
      const message = error instanceof Error ? error.message : 'Failed to browse directory';
      logger.error('Error browsing filesystem', error);
      throw createError(message, 500, error);
    }
  }));
}

/**
 * Get system disk drives
 * Returns array of drive information
 */
async function getSystemDrives(): Promise<DriveInfo[]> {
  if (process.platform === 'win32') {
    // Windows: use wmic to get drive information (async)
    try {
      const { stdout } = await execFileAsync('wmic', [
        'logicaldisk', 'get', 'caption,freespace,size,volumename'
      ]);

      const drives: DriveInfo[] = [];
      const lines = stdout.trim().split('\n').slice(1); // Skip header

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const letter = parts[0];
          const free = parseInt(parts[1]) || 0;
          const total = parseInt(parts[2]) || 0;
          const label = parts.slice(3).join(' ') || 'Local Disk';

          if (letter && letter.endsWith(':')) {
            drives.push({
              letter,
              label,
              free: Math.round(free / (1024 * 1024 * 1024)), // Convert to GB
              total: Math.round(total / (1024 * 1024 * 1024))
            });
          }
        }
      }
      return drives;
    } catch (error) {
      logger.error('Error getting Windows drives', error);
      // Fallback: probe common drive letters in parallel
      const commonDrives = ['C', 'D', 'E', 'F', 'G', 'H'];
      const results = await Promise.allSettled(
        commonDrives.map(async (letter) => {
          await fsPromises.readdir(`${letter}:\\`);
          return { letter: `${letter}:`, label: 'Local Disk', free: 0, total: 0 };
        })
      );
      return results
        .filter((r): r is PromiseFulfilledResult<DriveInfo> => r.status === 'fulfilled')
        .map(r => r.value);
    }
  } else {
    // Linux/Mac: check mount points in parallel
    const mountPoints = ['/', '/home', '/mnt', '/media'];
    const results = await Promise.allSettled(
      mountPoints.map(async (mountPoint) => {
        const stats = await fsPromises.statfs(mountPoint);
        return {
          letter: mountPoint,
          label: mountPoint === '/' ? 'Root' : mountPoint,
          free: Math.round(stats.bavail * stats.bsize / (1024 * 1024 * 1024)),
          total: Math.round(stats.blocks * stats.bsize / (1024 * 1024 * 1024))
        };
      })
    );
    return results
      .filter((r): r is PromiseFulfilledResult<DriveInfo> => r.status === 'fulfilled')
      .map(r => r.value);
  }
}
