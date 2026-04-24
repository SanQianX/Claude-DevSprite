/**
 * Detector Factory with Fallback Strategy
 */

import type { Detector, DetectorType } from './types';
import { PostCommitHookDetector } from './postCommitHook';
import { DotGitWatcherDetector } from './dotGitWatcher';
import { ReflogPollerDetector } from './reflogPoller';

export async function createDetector(
  repoPath: string,
  type: DetectorType = 'post-commit-hook'
): Promise<Detector> {
  switch (type) {
    case 'post-commit-hook':
      return new PostCommitHookDetector(repoPath);
    case 'dotgit-watcher':
      return new DotGitWatcherDetector(repoPath);
    case 'reflog-poller':
      return new ReflogPollerDetector(repoPath);
    default:
      throw new Error(`Unknown detector type: ${type}`);
  }
}

export interface DetectorWithFallbackResult {
  detector: Detector;
  fallbackReason?: string;
}

export async function createDetectorWithFallback(repoPath: string): Promise<DetectorWithFallbackResult> {
  // Try strategies in order: post-commit-hook -> dotgit-watcher -> reflog-poller

  // Strategy 1: Try post-commit hook
  try {
    const hookDetector = new PostCommitHookDetector(repoPath);
    await hookDetector.start();
    await hookDetector.stop(); // Test if it can start/stop

    console.log('[DetectorFactory] Using post-commit-hook detector');
    return { detector: hookDetector };
  } catch (error) {
    console.warn('[DetectorFactory] Post-commit hook failed:', error);
  }

  // Strategy 2: Try dotgit watcher
  try {
    const watcherDetector = new DotGitWatcherDetector(repoPath);
    await watcherDetector.start();
    await watcherDetector.stop(); // Test if it can start/stop

    console.log('[DetectorFactory] Using dotgit-watcher detector (fallback from post-commit-hook)');
    return {
      detector: watcherDetector,
      fallbackReason: 'post-commit-hook unavailable',
    };
  } catch (error) {
    console.warn('[DetectorFactory] Dotgit watcher failed:', error);
  }

  // Strategy 3: Use reflog poller (always works as fallback)
  console.log('[DetectorFactory] Using reflog-poller detector (fallback from dotgit-watcher)');
  const pollerDetector = new ReflogPollerDetector(repoPath, 1000);

  return {
    detector: pollerDetector,
    fallbackReason: 'post-commit-hook and dotgit-watcher unavailable',
  };
}
