/**
 * Search API Routes
 * GET /api/search
 * GET /api/projects/:name/search
 */

import type { Express, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { getProjectDiscoveryService } from '../../services/projectDiscovery';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('search');

export interface SearchResult {
  type: 'document' | 'source';
  path: string;
  title: string;
  snippet: string;
  matches: number;
  category?: string;
}

export function registerSearchRoutes(app: Express): void {
  /**
   * GET /api/search
   * Cross-project search
   */
  app.get('/api/search', asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      throw createError('Search query is required', 400);
    }

    try {
      const allResults: Array<{ projectName: string } & SearchResult> = [];

      // Get all projects
      const projectDiscovery = getProjectDiscoveryService();
      const projects = await projectDiscovery.getAllProjects();

      for (const project of projects) {
        if (fs.existsSync(project.knowledgePath)) {
          const projectResults = searchInDirectory(project.knowledgePath, q);
          for (const result of projectResults) {
            allResults.push({
              projectName: project.name,
              ...result
            });
          }
        }
      }

      res.json({ query: q, results: allResults });
    } catch (error) {
      logger.error('Error in cross-project search', error);
      throw createError('Search failed', 500, error);
    }
  }));

  /**
   * GET /api/projects/:name/search
   * Project-specific search
   */
  app.get('/api/projects/:name/search', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      throw createError('Search query is required', 400);
    }

    try {
      const projectDiscovery = getProjectDiscoveryService();
      const project = await projectDiscovery.getProject(name);

      if (!project) {
        throw createError('Project not found', 404);
      }

      if (!fs.existsSync(project.knowledgePath)) {
        throw createError('Project knowledge directory not found', 404);
      }

      const results = searchInDirectory(project.knowledgePath, q);
      res.json({ projectName: name, query: q, results });
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in project search', error);
      throw createError('Search failed', 500, error);
    }
  }));
}

function searchInDirectory(dirPath: string, query: string, rootPath?: string): SearchResult[] {
  const results: SearchResult[] = [];
  const baseRoot = rootPath || dirPath;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip .git, node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        const subResults = searchInDirectory(fullPath, query, baseRoot);
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const fileResult = searchInFile(fullPath, query, baseRoot);
        if (fileResult) {
          results.push(fileResult);
        }
      }
    }
  } catch (error) {
    // Ignore errors for directories we can't read
  }

  return results;
}

function searchInFile(filePath: string, query: string, rootPath: string): SearchResult | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data: meta, content: markdown } = matter(content);

    const queryLower = query.toLowerCase();

    // Check if file matches
    const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');
    const matchesInContent = (markdown.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
    const matchesInTitle = path.basename(filePath).toLowerCase().includes(queryLower) ? 1 : 0;
    const totalMatches = matchesInContent + matchesInTitle;

    if (totalMatches === 0) {
      return null;
    }

    // Extract snippet (first occurrence with context)
    const snippet = extractSnippet(markdown, query);

    // Extract title
    const firstLine = markdown.split('\n')[0];
    const title = firstLine.startsWith('#')
      ? firstLine.replace(/^#+\s+/, '').trim()
      : path.basename(filePath, '.md');

    return {
      type: 'document',
      path: relativePath,
      title,
      snippet,
      matches: totalMatches,
      category: (meta as Record<string, unknown>).category as string | undefined
    };
  } catch (error) {
    return null;
  }
}

function extractSnippet(content: string, query: string): string {
  const lines = content.split('\n');
  const queryLower = query.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(queryLower)) {
      // Get context: 2 lines before and after
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 3);
      return lines.slice(start, end).join('\n').trim();
    }
  }

  return content.substring(0, 200) + '...';
}
