/**
 * Source Tree API Routes
 * GET /api/projects/:name/source-tree - Return source code file tree
 * GET /api/projects/:name/source-file - Return source file content
 */

import type { Express, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { getDatabase } from '../db';
import { createLogger } from '../../utils/logger';

const logger = createLogger('source-tree');

interface SourceTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: SourceTreeNode[];
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  'coverage', '.cache', '__pycache__', '.idea', '.vscode',
]);

const IGNORE_FILES = new Set([
  '.DS_Store', 'Thumbs.db', '.gitkeep',
]);

function buildSourceTree(dirPath: string, relativePath: string = ''): SourceTreeNode[] {
  const entries: SourceTreeNode[] = [];

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    // Sort: directories first, then files, alphabetically
    const sorted = items.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const item of sorted) {
      const fullPath = path.join(dirPath, item.name);
      const relPath = relativePath ? `${relativePath}/${item.name}` : item.name;

      if (item.isDirectory()) {
        if (IGNORE_DIRS.has(item.name)) continue;

        const children = buildSourceTree(fullPath, relPath);
        entries.push({
          name: item.name,
          path: relPath,
          type: 'directory',
          children,
        });
      } else {
        if (IGNORE_FILES.has(item.name)) continue;
        // Skip very large binary files
        const ext = path.extname(item.name).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) continue;

        entries.push({
          name: item.name,
          path: relPath,
          type: 'file',
        });
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return entries;
}

export function registerSourceTreeRoutes(app: Express): void {
  /**
   * GET /api/projects/:name/source-tree
   * Returns the source code file tree for a project
   */
  app.get('/api/projects/:name/source-tree', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    const tree = buildSourceTree(project.path);
    res.json({ projectName, tree });
  }));

  /**
   * GET /api/projects/:name/source-file?path=...
   * Returns the content of a source file
   */
  app.get('/api/projects/:name/source-file', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const filePath = req.query.path as string;
    if (!filePath) throw createError('Path is required', 400);

    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    // Security: resolve and check path
    const fullPath = path.resolve(project.path, filePath);
    if (!fullPath.startsWith(path.resolve(project.path))) {
      throw createError('Path traversal not allowed', 403);
    }

    if (!fs.existsSync(fullPath)) {
      throw createError('File not found', 404);
    }

    const stat = fs.statSync(fullPath);
    if (stat.size > 1024 * 1024) {
      throw createError('File too large (max 1MB)', 400);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ path: filePath, content, size: stat.size });
  }));
}
