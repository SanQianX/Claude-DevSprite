/**
 * Git Reflog Poller Detector
 * Strategy C: Poll git reflog for new commits
 */

import simpleGit from 'simple-git';
import type { Detector, CommitEvent } from './types';
import { GitUtils } from '../utils/git';

export class ReflogPollerDetector implements Detector {
  name = 'reflog-poller';
  private interval: NodeJS.Timeout | null = null;
  private callback: ((event: CommitEvent) => void) | null = null;
  private lastCommitHash: string = '';
  private git: ReturnType<typeof simpleGit>;

  constructor(
    private readonly repoPath: string,
    private readonly pollIntervalMs = 1000
  ) {
    this.git = simpleGit(repoPath);
  }

  async start(): Promise<void> {
    // Initialize with current commit
    try {
      this.lastCommitHash = await this.git.revparse(['HEAD']);
    } catch (error) {
      console.error(`[ReflogPoller] Failed to get initial commit:`, error);
      return;
    }

    // Start polling
    this.interval = setInterval(async () => {
      await this.checkForNewCommits();
    }, this.pollIntervalMs);

    console.log(`[ReflogPoller] Started polling ${this.repoPath} every ${this.pollIntervalMs}ms`);
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log(`[ReflogPoller] Stopped`);
  }

  onCommit(callback: (event: CommitEvent) => void): void {
    this.callback = callback;
  }

  private async checkForNewCommits(): Promise<void> {
    try {
      const currentHash = await this.git.revparse(['HEAD']);

      if (currentHash !== this.lastCommitHash) {
        const log = await this.git.log({ maxCount: 1 });
        const commit = log.latest;

        if (commit) {
          const gitUtils = new GitUtils(this.repoPath);
          const changedFiles = await gitUtils.getChangedFiles(commit.hash);

          const event: CommitEvent = {
            repoPath: this.repoPath,
            commitHash: commit.hash,
            commitMessage: commit.message,
            author: commit.author_name,
            timestamp: new Date(commit.date),
            changedFiles,
          };

          console.log(`[ReflogPoller] New commit detected: ${commit.hash.substring(0, 7)} - ${commit.message}`);

          this.lastCommitHash = currentHash;
          this.callback?.(event);
        }
      }
    } catch (error) {
      console.error(`[ReflogPoller] Error checking for new commits:`, error);
    }
  }
}
