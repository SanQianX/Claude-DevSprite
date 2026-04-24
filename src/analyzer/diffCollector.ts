/**
 * Diff Collector
 * Collects and parses git diffs
 */

import simpleGit from 'simple-git';
import type { DiffEntry } from './types';

export class DiffCollector {
  private git: ReturnType<typeof simpleGit>;

  constructor(private readonly repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  /**
   * Collect diffs for a specific commit
   */
  async collectDiffs(commitHash: string): Promise<DiffEntry[]> {
    const diffs: DiffEntry[] = [];

    try {
      // Get the diff summary
      const summary = await this.git.diffSummary([`${commitHash}~1`, commitHash]);

      for (const file of summary.files) {
        const diffContent = await this.git.diff([`${commitHash}~1`, commitHash, '--', file.file]);

        const diffEntry: DiffEntry = {
          filePath: file.file,
          changeType: this.getChangeType(file),
          additions: (file as any).insertions || 0,
          deletions: (file as any).deletions || 0,
          diff: diffContent,
        };

        diffs.push(diffEntry);
      }
    } catch (error) {
      console.error('[DiffCollector] Error collecting diffs:', error);
    }

    return diffs;
  }

  /**
   * Parse a unified diff string
   */
  parseDiff(diff: string): DiffEntry {
    const lines = diff.split('\n');
    let filePath = '';
    let changeType: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified';
    let additions = 0;
    let deletions = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extract file path
      const match = line.match(/^(a\/|b\/)?(.+)$/);
      if (match && (line.startsWith('---') || line.startsWith('+++'))) {
        filePath = match[2];
      }

      // Detect change type
      if (line.startsWith('new file')) {
        changeType = 'added';
      } else if (line.startsWith('deleted file')) {
        changeType = 'deleted';
      } else if (line.startsWith('rename from')) {
        changeType = 'renamed';
      }

      // Count additions and deletions
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    return {
      filePath,
      changeType,
      additions,
      deletions,
      diff,
    };
  }

  private getChangeType(file: any): 'added' | 'modified' | 'deleted' | 'renamed' {
    if (file.binary) return 'modified';
    if (file.status === 'added') return 'added';
    if (file.status === 'deleted') return 'deleted';
    if (file.status === 'renamed') return 'renamed';
    return 'modified';
  }
}
