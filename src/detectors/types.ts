/**
 * Git Commit Detector Types
 */

export interface CommitEvent {
  repoPath: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  timestamp: Date;
  changedFiles: string[];
}

export interface Detector {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onCommit(callback: (event: CommitEvent) => void): void;
}

export type DetectorType = 'post-commit-hook' | 'dotgit-watcher' | 'reflog-poller';
