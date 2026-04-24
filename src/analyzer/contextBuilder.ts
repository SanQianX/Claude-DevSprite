/**
 * Context Builder
 * Builds analysis context from diffs and existing knowledge
 */

import simpleGit from 'simple-git';
import type { AnalysisContext, DiffEntry } from './types';

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
   * For now, this is a simplified version that returns empty array
   * In a full implementation, this would query the database
   */
  async loadRelevantKnowledge(changedFiles: string[]): Promise<string[]> {
    // TODO: Implement database query for relevant documents
    // This would involve:
    // 1. Finding documents that reference the changed files
    // 2. Finding documents in similar categories
    // 3. Finding documents with related tags

    return [];
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
