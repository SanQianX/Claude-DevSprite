/**
 * CommitDetectorManager
 * Manages multiple Git commit detection strategies with fallback
 * 
 * Detection Strategy Fallback Mechanism:
 * - Primary: Git Hook (post-commit hook) - triggered automatically after commits
 * - Secondary: .git directory watcher (dotGitWatcher) - monitors .git directory for changes
 * - Tertiary: Reflog poller (reflogPoller) - polls reflog for new commits at intervals
 * This strategy ensures commit detection is reliable across different Git setups.
 */

import type { CommitEvent, Detector } from './types';
import { createDetectorWithFallback, DetectorWithFallbackResult } from './detectorFactory';

export class CommitDetectorManager {
  private detectors: Detector[] = [];
  private callbacks: ((event: CommitEvent) => void)[] = [];
  private activeDetector: Detector | null = null;
  private fallbackReason: string | undefined;

  constructor(private readonly repoPath: string) {}

  /**
   * Register a callback for commit events
   */
  onCommit(callback: (event: CommitEvent) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Start detection with fallback strategy
   */
  async start(): Promise<void> {
    console.log(`[CommitDetectorManager] Starting detection for ${this.repoPath}`);

    // Create detector with fallback
    const result: DetectorWithFallbackResult = await createDetectorWithFallback(this.repoPath);
    this.activeDetector = result.detector;
    this.fallbackReason = result.fallbackReason;

    // Register callback
    this.activeDetector.onCommit((event: CommitEvent) => {
      this.emit(event);
    });

    // Start the detector
    await this.activeDetector.start();
    this.detectors.push(this.activeDetector);

    console.log(`[CommitDetectorManager] Using detector: ${this.activeDetector.name}${this.fallbackReason ? ` (${this.fallbackReason})` : ''}`);
  }

  /**
   * Stop all detectors
   */
  async stop(): Promise<void> {
    await Promise.all(this.detectors.map(d => d.stop()));
    this.detectors = [];
    this.activeDetector = null;
    console.log(`[CommitDetectorManager] Stopped all detectors`);
  }

  /**
   * Get current detector status
   */
  getStatus(): {
    activeDetector: string | null;
    fallbackReason: string | undefined;
    isRunning: boolean;
  } {
    return {
      activeDetector: this.activeDetector?.name || null,
      fallbackReason: this.fallbackReason,
      isRunning: this.activeDetector !== null,
    };
  }

  /**
   * Emit commit event to all callbacks
   */
  private emit(event: CommitEvent): void {
    this.callbacks.forEach(cb => cb(event));
  }
}

export * from './types';
export * from './postCommitHook';
export * from './dotGitWatcher';
export * from './reflogPoller';
export * from './detectorFactory';