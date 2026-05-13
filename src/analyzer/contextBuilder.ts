/**
 * Context Builder
 * Builds analysis context from diffs and existing knowledge
 */

import simpleGit from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import type { AnalysisContext, DiffEntry } from './types';
import { config } from '../config';

export class ContextBuilder {
  private git: ReturnType<typeof simpleGit>;

  constructor(private readonly repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  /**
   * Build complete analysis context
   */
  async buildContext(commitHash: string, diffs: DiffEntry[]): Promise<AnalysisContext> {
    // Get commit details using show for reliability
    let commitMessage = '';
    try {
      const showOutput = await this.git.raw(['log', '-1', '--format=%s', commitHash]);
      commitMessage = showOutput.trim();
    } catch (error) {
      console.error(`[ContextBuilder] Failed to get commit message:`, error);
      commitMessage = `Commit ${commitHash.substring(0, 7)}`;
    }

    // Load relevant existing knowledge
    const changedFiles = diffs.map(d => d.filePath);
    const previousKnowledge = await this.loadRelevantKnowledge(changedFiles);

    return {
      repoPath: this.repoPath,
      commitHash,
      commitMessage,
      mode: 'incremental', // Will be updated by ModeDecider
      diffs,
      previousKnowledge,
    };
  }

  /**
   * Load relevant existing knowledge for context
   * Finds documents that reference changed files or are in related categories
   */
  async loadRelevantKnowledge(changedFiles: string[]): Promise<string[]> {
    // Use project-level knowledge directory from config, with default 'knowledge'
    const directoryName = config.knowledge.directoryName || 'knowledge';
    const knowledgePath = path.join(this.repoPath, directoryName);
    if (!fs.existsSync(knowledgePath)) {
      return [];
    }

    const knowledge: string[] = [];
    const changedFileNames = changedFiles.map(f => path.basename(f).toLowerCase());
    const changedDirs = changedFiles.map(f => path.dirname(f).toLowerCase());

    try {
      const files = this.walkDir(knowledgePath, '.md');
      for (const filePath of files) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const { content: markdown } = matter(content);
          const relativePath = path.relative(knowledgePath, filePath).replace(/\\/g, '/');

          // Check if any changed file is referenced in this document
          const markdownLower = markdown.toLowerCase();
          const isRelevant = changedFiles.some(cf =>
            markdownLower.includes(cf.toLowerCase()) ||
            markdownLower.includes(path.basename(cf).toLowerCase())
          );

          // Also include if the doc is in a directory related to changed files
          const isInRelevantDir = changedDirs.some(dir =>
            relativePath.toLowerCase().includes(dir)
          );

          // Include overview docs always (they provide project context)
          const isOverview = relativePath.includes('overview') || relativePath.includes('architecture');

          if (isRelevant || isInRelevantDir || isOverview) {
            // Truncate long documents to avoid context overflow
            const truncated = markdown.length > 2000
              ? markdown.substring(0, 2000) + '\n... (truncated)'
              : markdown;
            knowledge.push(`--- Document: ${relativePath} ---\n${truncated}`);
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      console.error('[ContextBuilder] Failed to load knowledge:', error);
    }

    return knowledge;
  }

  /**
   * Walk directory and return matching files
   */
  private walkDir(dirPath: string, extension: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          results.push(...this.walkDir(fullPath, extension));
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          results.push(fullPath);
        }
      }
    } catch {
      // Skip directories that can't be read
    }
    return results;
  }

  /**
   * Get file content at a specific commit
   */
  async getFileContent(filePath: string, commitHash: string): Promise<string> {
    try {
      const content = await this.git.show([`${commitHash}:${filePath}`]);
      return content;
    } catch (error) {
      console.error(`[ContextBuilder] Failed to get content for ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Get repository structure
   */
  async getRepositoryStructure(commitHash?: string): Promise<string[]> {
    try {
      const ref = commitHash || 'HEAD';
      const result = await this.git.raw(['ls-tree', '--name-only', '-r', ref]);
      return result.trim().split('\n').filter(Boolean);
    } catch (error) {
      console.error('[ContextBuilder] Failed to get repository structure:', error);
      return [];
    }
  }
}