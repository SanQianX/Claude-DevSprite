/**
 * Git Utilities
 * Wrapper around simple-git for common operations
 */

import simpleGit from 'simple-git';

export class GitUtils {
  private git = simpleGit();

  constructor(private readonly repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  /**
   * Get current commit hash
   */
  async getCurrentCommit(): Promise<string> {
    const log = await this.git.log({ maxCount: 1 });
    return log.latest?.hash || '';
  }

  /**
   * Get commit details
   */
  async getCommitDetails(commitHash: string): Promise<{
    hash: string;
    message: string;
    author: string;
    date: Date;
  } | null> {
    const log = await this.git.log({ maxCount: 1, from: commitHash });
    const commit = log.latest;
    if (!commit) return null;

    return {
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name,
      date: new Date(commit.date),
    };
  }

  /**
   * Get files changed in a commit
   */
  async getChangedFiles(commitHash: string): Promise<string[]> {
    const diff = await this.git.diff([`${commitHash}~1`, commitHash, '--name-only']);
    return diff.split('\n').filter(f => f.trim());
  }

  /**
   * Get diff for specific files
   */
  async getDiff(commitHash: string, filePath?: string): Promise<string> {
    const args = [`${commitHash}~1`, commitHash];
    if (filePath) args.push('--', filePath);
    return await this.git.diff(args);
  }

  /**
   * Check if path is a git repository
   */
  static async isGitRepo(path: string): Promise<boolean> {
    try {
      const git = simpleGit(path);
      await git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get repository root
   */
  static async getRepoRoot(path: string): Promise<string | null> {
    try {
      const git = simpleGit({ baseDir: path });
      const root = await git.revparse(['--show-toplevel']);
      return root;
    } catch {
      return null;
    }
  }
}
