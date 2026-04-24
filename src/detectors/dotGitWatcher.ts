/**
 * .git Directory Watcher Detector
 * Strategy B: Watch HEAD file and refs/heads changes
 */

import * as chokidar from 'chokidar';
import * as path from 'path';
import simpleGit from 'simple-git';
import type { Detector, CommitEvent } from './types';
import { GitUtils } from '../utils/git';

export class DotGitWatcherDetector implements Detector {
  name = 'dotgit-watcher';
  private watcher: chokidar.FSWatcher | null = null;
  private callback: ((event: CommitEvent) => void) | null = null;
  private lastCommitHash: string = '';
  private git: ReturnType<typeof simpleGit>;

  constructor(private readonly repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  async start(): Promise<void> {
    try {
      // Initialize with current commit
      this.lastCommitHash = await this.git.revparse(['HEAD']);
    } catch (error) {
      console.error(`[DotGitWatcher] Failed to get initial commit:`, error);
      return;
    }

    // Watch HEAD and refs/heads directory
    const watchPaths = [
      path.join(this.repoPath, '.git', 'HEAD'),
      path.join(this.repoPath, '.git', 'refs', 'heads'),
    ];

    this.watcher = chokidar.watch(watchPaths, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 10,
      },
    });

    // Debounce commit detection
    let debounceTimer: NodeJS.Timeout | null = null;

    this.watcher.on('all', (eventName, filePath) => {
      if (eventName === 'add' || eventName === 'change') {
        // Debounce to avoid multiple detections for the same commit
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(async () => {
          await this.checkForNewCommit();
        }, 200);
      }
    });

    console.log(`[DotGitWatcher] Started watching ${watchPaths.join(', ')}`);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    console.log(`[DotGitWatcher] Stopped`);
  }

  onCommit(callback: (event: CommitEvent) => void): void {
    this.callback = callback;
  }

  private async checkForNewCommit(): Promise<void> {
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

          console.log(`[DotGitWatcher] New commit detected: ${commit.hash.substring(0, 7)} - ${commit.message}`);

          this.lastCommitHash = currentHash;
          this.callback?.(event);
        }
      }
    } catch (error) {
      console.error(`[DotGitWatcher] Error checking for new commit:`, error);
    }
  }
}
