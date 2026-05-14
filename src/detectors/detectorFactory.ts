/**
 * Detector Factory with Fallback Strategy
 *
 * 该模块提供了用于检测 Git 事件（如提交）的检测器工厂。它实现了三种检测策略及其自动回退机制，
 * 确保了在不同环境和权限下都能可靠地捕获提交事件，并将事件流集成到核心分析流水线中。
 *
 * ## 模块在架构中的位置与角色
 * 本模块属于项目功能架构的 **事件源 (Event Sources)** 层，是 **提交检测 (Detectors)** 子系统的核心实现。
 * 它为整个分析流水线提供标准化、可靠的 Git 提交事件流，是触发后续所有分析步骤的起点。
 *
 * ### 提交检测子系统设计与回退策略
 * 提交检测子系统的核心目标是**在不同的运行环境和用户权限下，可靠地获取Git提交事件流**。为达成此目标，
 * 系统采用了分层策略与自动回退机制，具体设计如下：
 *
 * 1.  **首选策略 (PostCommitHookDetector)**：
 *     *   **机制**：通过在目标仓库的 `.git/hooks` 目录下安装一个 `post-commit` 钩子脚本来工作。当有提交发生时，钩子脚本会立即触发。
 *     *   **优点**：实时性最高，是Git原生支持的事件驱动方式。
 *     *   **回退条件**：当运行环境无权写入 `.git/hooks` 目录（如权限限制、只读文件系统）或钩子脚本安装失败时，该策略失败，系统将自动回退。
 *
 * 2.  **次选策略 (DotGitWatcherDetector)**：
 *     *   **机制**：使用文件系统监听器（如 `fs.watch` 或 `chokidar`）监控 `.git/` 目录下的特定文件变化（如 `COMMIT_EDITMSG`, `HEAD`）。这是一种异步的文件级监听。
 *     *   **优点**：无需修改仓库内容（如安装钩子），对用户透明。
 *     *   **回退条件**：当运行环境不支持或限制文件系统监听（如某些容器化环境、网络文件系统），或监听器依赖缺失时，该策略失败，系统将自动回退。
 *
 * 3.  **最终保障 (ReflogPollerDetector)**：
 *     *   **机制**：以固定的时间间隔（例如每秒）轮询 `git reflog` 的输出，通过对比差异来检测新提交。
 *     *   **优点**：实现简单，仅依赖Git命令行工具，几乎在任何支持Git的环境下都可用。
 *     *   **定位**：作为前两种策略均失败后的最终回退方案（Fallback）。虽然效率较低且存在固有延迟（等于轮询间隔），但它保证了事件检测的**可用性**（Availability），确保流水线在任何情况下都能获得事件输入，避免完全中断。
 *
 * ## 回退机制
 * `createDetectorWithFallback` 函数实现了上述策略的自动回退逻辑，其核心设计是**按可靠性/效率降序尝试**：Hook -> Watcher -> Poller。
 * 每种策略在尝试启动时都会进行验证（`start` 后 `stop`），确保其在当前环境下可正常工作。任何一步失败都会触发对下一种策略的尝试，直至成功或使用最终的轮询策略。
 * 此机制牺牲了部分效率（在回退到轮询时），换取了系统整体的**可靠性**，确保了Git事件流的连续性，从而支撑后续分析流水线的稳定运行。
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
 * ## 配置选项
 * - **DetectorType**: 可通过 `createDetector` 函数显式指定检测策略类型，支持 'post-commit-hook', 'dotgit-watcher', 'reflog-poller'。
 * - **回退策略配置**: `createDetectorWithFallback` 使用固定的回退顺序（Hook -> Watcher -> Poller），当前未提供配置接口，但设计上可扩展。
 * - **轮询间隔**: `ReflogPollerDetector` 在回退策略中使用固定间隔（1秒），未来可考虑作为配置参数。
 *
 * ## 与核心分析流水线的集成
 * 创建出的 `Detector` 实例实现了标准的 `Detector` 接口，提供 `start()`, `stop()` 和 `onCommit` 事件。
 * 核心流水线只需调用 `createDetectorWithFallback` 并订阅返回的 `detector.onCommit` 事件，即可获得标准化的提交事件流，无需关心底层的具体检测机制。
 * 这种解耦设计使得事件源可以灵活切换和回退，而不影响流水线的其他部分。
 *
 * @see FUNCTIONAL-LOGIC-ANALYSIS.md - 项目功能架构图与模块清单（应包含'提交检测 (Detectors)'模块详细描述，包括本模块所述内容）。
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