/**
 * Analysis Mode Decider
 * Decides between incremental and full analysis mode
 */

import type { AnalysisMode, DiffEntry } from './types';

export class ModeDecider {
  /**
   * Decide analysis mode based on context
   */
  decideAnalysisMode(
    diffs: DiffEntry[],
    totalFileCount: number = 100
  ): AnalysisMode {
    const changedFilesCount = diffs.length;
    const linesChanged = diffs.reduce((sum, d) => sum + d.additions + d.deletions, 0);

    // Heuristics for deciding analysis mode

    // If this is the first analysis (no knowledge base), use full mode
    if (totalFileCount === 0) {
      return 'full';
    }

    // If more than 30% of files are changed, use full mode
    const changeRatio = changedFilesCount / totalFileCount;
    if (changeRatio > 0.3) {
      return 'full';
    }

    // If more than 1000 lines are changed, use full mode
    if (linesChanged > 1000) {
      return 'full';
    }

    // If multiple major files are deleted or renamed, use full mode
    const majorChanges = diffs.filter(
      d => d.changeType === 'deleted' || d.changeType === 'renamed'
    ).length;
    if (majorChanges > 5) {
      return 'full';
    }

    // Default to incremental mode
    return 'incremental';
  }

  /**
   * Update the mode in the context based on analysis
   */
  updateMode(diffs: DiffEntry[], context: { mode: AnalysisMode }): AnalysisMode {
    const mode = this.decideAnalysisMode(diffs);
    context.mode = mode;
    return mode;
  }
}
