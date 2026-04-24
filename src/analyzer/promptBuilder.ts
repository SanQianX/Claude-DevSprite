/**
 * Prompt Builder
 * Constructs prompts for AI analysis
 */

import type { AnalysisContext } from './types';
import { PROMPT_TEMPLATES } from './promptTemplates';

export class PromptBuilder {
  /**
   * Build analysis prompt
   */
  buildPrompt(context: AnalysisContext): string {
    const template = context.mode === 'full'
      ? PROMPT_TEMPLATES.fullAnalysis
      : PROMPT_TEMPLATES.incrementalAnalysis;

    return template
      .replace('{{commitMessage}}', context.commitMessage)
      .replace('{{commitHash}}', context.commitHash)
      .replace('{{changedFiles}}', this.formatChangedFiles(context.diffs))
      .replace('{{previousKnowledge}}', this.formatPreviousKnowledge(context.previousKnowledge || []));
  }

  /**
   * Format changed files for prompt
   */
  private formatChangedFiles(diffs: any[]): string {
    if (diffs.length === 0) {
      return 'No files changed.';
    }

    let result = '## Changed Files\n\n';
    diffs.forEach((diff, index) => {
      result += `${index + 1}. **${diff.filePath}** (${diff.changeType})\n`;
      result += `   - Additions: ${diff.additions}, Deletions: ${diff.deletions}\n`;
      if (diff.diff) {
        // Include a truncated version of the diff
        const diffPreview = this.truncateDiff(diff.diff, 20);
        result += `   \`\`\`diff\n${diffPreview}\n   \`\`\`\n`;
      }
      result += '\n';
    });

    return result;
  }

  /**
   * Format previous knowledge for prompt
   */
  private formatPreviousKnowledge(previousKnowledge: string[]): string {
    if (previousKnowledge.length === 0) {
      return 'No previous knowledge available.';
    }

    let result = '## Previous Knowledge\n\n';
    previousKnowledge.forEach((knowledge, index) => {
      result += `${index + 1}. ${knowledge}\n`;
    });
    return result;
  }

  /**
   * Truncate diff to a reasonable length
   */
  private truncateDiff(diff: string, maxLines: number): string {
    const lines = diff.split('\n');
    if (lines.length <= maxLines) {
      return diff;
    }

    return lines.slice(0, maxLines).join('\n') + '\n... (truncated)';
  }
}
