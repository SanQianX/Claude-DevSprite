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

  /**
   * GET /api/projects/:name/related-docs?path=...
   * Returns markdown documents that reference the given source file via [source:path:line]
   */
  app.get('/api/projects/:name/related-docs', asyncHandler(async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const sourcePath = req.query.path as string;
    if (!sourcePath) throw createError('Path is required', 400);

    const db = await getDatabase();
    const project = db.getProject(projectName);
    if (!project) throw createError('Project not found', 404);

    const knowledgePath = project.knowledge_path;
    if (!fs.existsSync(knowledgePath)) {
      res.json({ docs: [] });
      return;
    }

    const relatedDocs = searchRelatedDocs(knowledgePath, sourcePath);
    res.json({ docs: relatedDocs });
  }));
}

interface RelatedDoc {
  path: string;
  title: string;
  lines: number[];
}

function searchRelatedDocs(knowledgePath: string, sourcePath: string): RelatedDoc[] {
  const results: RelatedDoc[] = [];
  const escapedPath = sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\[source:${escapedPath}:(\\d+)\\]`, 'g');

  function walkDir(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walkDir(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines: number[] = [];
          const contentLines = content.split('\n');
          for (let i = 0; i < contentLines.length; i++) {
            if (pattern.test(contentLines[i])) {
              lines.push(i + 1);
            }
            // Reset regex lastIndex since we're using test in a loop
            pattern.lastIndex = 0;
          }
          if (lines.length > 0) {
            const relPath = path.relative(knowledgePath, fullPath).replace(/\\/g, '/');
            // Extract title from first heading or filename
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1].trim() : entry.name.replace(/\.md$/, '');
            results.push({ path: relPath, title, lines });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  walkDir(knowledgePath);
  return results;
}
