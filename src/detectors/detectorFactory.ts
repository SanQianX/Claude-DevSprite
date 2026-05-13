/**
 * Detector Factory with Fallback Strategy
 *
 * 该模块提供了用于检测 Git 事件（如提交）的检测器工厂。它实现了三种检测策略及其自动回退机制，
 * 确保了在不同环境和权限下都能可靠地捕获提交事件，并将事件流集成到核心分析流水线中。
 *
 * ## 检测策略
 * 1.  **PostCommitHookDetector (首选策略)**: 通过在目标仓库 `.git/hooks` 目录下安装一个 `post-commit` 钩子脚本来工作。当有提交发生时，钩子脚本会立即触发。
 * 2.  **DotGitWatcherDetector (第二策略)**: 使用文件系统监听器（如 `fs.watch` 或 `chokidar`）监控 `.git/` 目录下的特定文件变化（如 `COMMIT_EDITMSG`, `HEAD`）。这是一种异步的文件级监听。
 * 3.  **ReflogPollerDetector (最终回退策略)**: 以固定的时间间隔（例如每秒）轮询 `git reflog` 的输出。虽然效率较低且存在延迟，但它几乎在任何环境下都可用，是最后的保障。
 *
 * ## 回退机制
 * `createDetectorWithFallback` 函数会按顺序尝试启动前两种策略（Hook -> Watcher）。
 * 如果策略因环境不支持（例如，用户没有写入 `.git/hooks` 的权限）或依赖缺失而失败，则会自动回退到下一种策略。
 * 如果所有高级策略均失败，则默认使用 `ReflogPollerDetector`。
 *
 * ## 与核心分析流水线的集成
 * 创建出的 `Detector` 实例实现了标准的 `Detector` 接口，提供 `start()`, `stop()` 和 `onCommit` 事件。
 * 核心流水线只需调用 `createDetectorWithFallback` 并订阅返回的 `detector.onCommit` 事件，即可获得标准化的提交事件流，无需关心底层的具体检测机制。
 * 这种解耦设计使得事件源可以灵活切换和回退，而不影响流水线的其他部分。
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