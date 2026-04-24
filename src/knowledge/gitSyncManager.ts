/**
 * Git Sync Manager
 * Handles git operations for knowledge base
 */

import simpleGit from 'simple-git';

export class GitSyncManager {
  private git = simpleGit();

  constructor(private readonly repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  /**
   * Commit knowledge base changes
   */
  async commit(message: string): Promise<void> {
    await this.git.add('knowledge/');
    await this.git.commit(message);
  }

  /**
   * Get current commit hash
   */
  async getCurrentCommit(): Promise<string> {
    const log = await this.git.log({ maxCount: 1 });
    return log.latest?.hash || '';
  }

  /**
   * Check if knowledge base is dirty
   */
  async isDirty(): Promise<boolean> {
    const status = await this.git.status();
    return status.files.length > 0;
  }
}
