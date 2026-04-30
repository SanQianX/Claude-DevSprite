/**
 * Files API Routes
 * GET /api/projects/:name/tree
 * GET /api/projects/:name/file
 * GET /api/projects/:name/source
 */

import type { Express, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { getProjectDiscoveryService } from '../../services/projectDiscovery';
import { createError, asyncHandler } from '../middleware/errorHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('files');

/**
 * Prevent path traversal attacks - ensure resolved path is within base directory
 */
function isPathSafe(baseDir: string, userInput: string): boolean {
  const resolved = path.resolve(baseDir, userInput);
  return resolved.startsWith(path.resolve(baseDir) + path.sep) || resolved === path.resolve(baseDir);
}

export interface FileTreeNode {
  name: string;
  type: 'directory' | 'file';
  path: string;
  children?: FileTreeNode[];
}

export function registerFileRoutes(app: Express): void {
  /**
   * GET /api/projects/:name/tree
   * Get file tree structure
   */
  app.get('/api/projects/:name/tree', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;
    const { root = '' } = req.query;

    try {
      const projectDiscovery = getProjectDiscoveryService();
      const project = await projectDiscovery.getProject(name);

      if (!project) {
        throw createError('Project not found', 404);
      }

      const knowledgePath = project.knowledgePath;

      if (!fs.existsSync(knowledgePath)) {
        throw createError('Project knowledge directory not found', 404);
      }

      const scanPath = root ? path.join(knowledgePath, root as string) : knowledgePath;

      if (!fs.existsSync(scanPath)) {
        throw createError('Directory not found', 404);
      }

      const tree = buildFileTree(scanPath, knowledgePath);
      // Normalize path separators to forward slashes for consistent frontend routing
      const normalizedTree = normalizePathSeparators(tree);

      // Check if the tree is empty (no markdown files found)
      if (normalizedTree.length === 0) {
        logger.warn(`No markdown files found in knowledge directory: ${scanPath}`);
        res.json({ projectName: name, tree: normalizedTree, isEmpty: true });
      } else {
        res.json({ projectName: name, tree: normalizedTree, isEmpty: false });
      }
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting file tree', error);
      throw createError('Failed to get file tree', 500, error);
    }
  }));

  /**
   * GET /api/projects/:name/file
   * Get document content with frontmatter
   */
  app.get('/api/projects/:name/file', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;
    const { path: filePath } = req.query;

    if (!filePath || typeof filePath !== 'string') {
      throw createError('File path is required', 400);
    }

    try {
      const projectDiscovery = getProjectDiscoveryService();
      const project = await projectDiscovery.getProject(name);

      if (!project) {
        throw createError('Project not found', 404);
      }

      if (!isPathSafe(project.knowledgePath, filePath)) {
        throw createError('Invalid file path', 403);
      }

      const fullPath = path.join(project.knowledgePath, filePath);

      if (!fs.existsSync(fullPath)) {
        throw createError('File not found', 404);
      }

      if (!fs.statSync(fullPath).isFile()) {
        throw createError('Not a file', 400);
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      const { data: meta, content: markdown } = matter(content);

      // Extract title from frontmatter title, first heading, or filename
      let title = (meta as Record<string, unknown>).title as string | undefined;
      if (!title) {
        const headingMatch = markdown.match(/^#+\s+(.+)$/m);
        title = headingMatch ? headingMatch[1].trim() : path.basename(filePath, '.md');
      }

      res.json({
        path: filePath,
        title,
        content: markdown,
        meta: {
          category: (meta as Record<string, unknown>).category || 'general',
          createdAt: (meta as Record<string, unknown>).date || new Date().toISOString(),
          updatedAt: (meta as Record<string, unknown>).updatedAt || new Date().toISOString(),
          ...meta
        }
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting file content', error);
      throw createError('Failed to get file content', 500, error);
    }
  }));

  /**
   * GET /api/projects/:name/source
   * Get source code content with optional line range
   */
  app.get('/api/projects/:name/source', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;
    const { path: filePath, start, end } = req.query;

    if (!filePath || typeof filePath !== 'string') {
      throw createError('File path is required', 400);
    }

    try {
      const projectDiscovery = getProjectDiscoveryService();
      const project = await projectDiscovery.getProject(name);

      if (!project) {
        throw createError('Project not found', 404);
      }

      // Source files are in the project root, not in knowledge directory
      if (!isPathSafe(project.path, filePath)) {
        throw createError('Invalid file path', 403);
      }

      const fullPath = path.join(project.path, filePath);

      if (!fs.existsSync(fullPath)) {
        throw createError('Source file not found', 404);
      }

      if (!fs.statSync(fullPath).isFile()) {
        throw createError('Not a file', 400);
      }

      const fullContent = fs.readFileSync(fullPath, 'utf-8');
      const lines = fullContent.split('\n');
      const totalLines = lines.length;

      const startLine = start ? parseInt(start as string, 10) : 1;
      const endLine = end ? parseInt(end as string, 10) : totalLines;

      let content: string;

      if (startLine && endLine) {
        content = lines.slice(startLine - 1, endLine).join('\n');
      } else {
        content = fullContent;
      }

      // Detect language from extension
      const ext = path.extname(filePath).toLowerCase();
      const language = getLanguageFromExtension(ext);

      res.json({
        path: filePath,
        language,
        totalLines,
        content,
        startLine: startLine || 1,
        endLine: endLine || totalLines
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting source content', error);
      throw createError('Failed to get source content', 500, error);
    }
  }));
}

function normalizePathSeparators(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.map(node => ({
    ...node,
    path: node.path.replace(/\\/g, '/'),
    children: node.children ? normalizePathSeparators(node.children) : undefined
  }));
}

function buildFileTree(dirPath: string, rootPath: string): FileTreeNode[] {
  const nodes: FileTreeNode[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        // Skip .git, node_modules, and other common ignore patterns
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        const children = buildFileTree(fullPath, rootPath);
        nodes.push({
          name: entry.name,
          type: 'directory',
          path: relativePath,
          children
        });
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        nodes.push({
          name: entry.name,
          type: 'file',
          path: relativePath
        });
      }
    }
  } catch (error) {
    // Ignore errors for directories we can't read
  }

  // Sort: directories first, then files, both alphabetically
  return nodes.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === 'directory' ? -1 : 1;
  });
}

function getLanguageFromExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.rb': 'ruby',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.sh': 'bash',
    '.zsh': 'zsh',
    '.bash': 'bash',
    '.ps1': 'powershell',
    '.sql': 'sql',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.md': 'markdown',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.astro': 'astro'
  };

  return languageMap[ext] || 'text';
}
