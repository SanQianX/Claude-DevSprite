/**
 * Post tool use hook
 * Processes after tool calls complete
 * Tracks file modifications for analysis context
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('postToolUse');

// Track recently modified files for context building
const recentModifications: Map<string, { tool: string; timestamp: Date }[]> = new Map();

export async function onPostToolUse(toolName: string, result: unknown): Promise<void> {
  // Track file write/edit operations
  if (['Write', 'Edit', 'NotebookEdit'].includes(toolName)) {
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result || {});

    // Extract file path from result if possible
    const pathMatch = resultStr.match(/file_path["\s:]+["']?([^"'\s,}]+)/);
    if (pathMatch) {
      const filePath = pathMatch[1];
      const existing = recentModifications.get(filePath) || [];
      existing.push({ tool: toolName, timestamp: new Date() });
      recentModifications.set(filePath, existing);

      // Keep only last 50 modifications
      if (existing.length > 50) {
        recentModifications.set(filePath, existing.slice(-50));
      }
    }
  }

  // Log significant tool usage
  if (['Bash', 'Write', 'Edit'].includes(toolName)) {
    logger.debug(`Tool used: ${toolName}`);
  }
}

/**
 * Get recently modified files
 */
export function getRecentModifications(): Map<string, { tool: string; timestamp: Date }[]> {
  return recentModifications;
}
