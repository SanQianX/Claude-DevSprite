/**
 * Git Post-Commit Hook Detector
 * Strategy A: Use native Git post-commit hooks
 */

import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import type { Detector, CommitEvent } from './types';
import { GitUtils } from '../utils/git';

const HOOK_FILE = 'post-commit';
const DEVSPRITE_MARKER = '# DEVSPRITE_HOOK';

export class PostCommitHookDetector implements Detector {
  name = 'post-commit-hook';
  private callback: ((event: CommitEvent) => void) | null = null;
  private git: ReturnType<typeof simpleGit>;
  private hooksDir: string;

  constructor(private readonly repoPath: string) {
    this.git = simpleGit(repoPath);
    this.hooksDir = path.join(repoPath, '.git', 'hooks');
  }

  async start(): Promise<void> {
    // Ensure hooks directory exists
    if (!fs.existsSync(this.hooksDir)) {
      fs.mkdirSync(this.hooksDir, { recursive: true });
    }

    const hookPath = path.join(this.hooksDir, HOOK_FILE);

    // Check if hook already exists and has our marker
    let hookContent = '';
    if (fs.existsSync(hookPath)) {
      hookContent = fs.readFileSync(hookPath, 'utf-8');
    }

    if (!hookContent.includes(DEVSPRITE_MARKER)) {
      // Append our hook to existing content or create new
      const newHook = this.generateHookScript(hookContent);
      // Write with LF line endings for cross-platform compatibility
      fs.writeFileSync(hookPath, newHook.replace(/\r\n/g, '\n'), 'utf-8');
      console.log(`[PostCommitHook] Installed hook at ${hookPath}`);
    }

    console.log(`[PostCommitHook] Started`);
  }

  async stop(): Promise<void> {
    const hookPath = path.join(this.hooksDir, HOOK_FILE);

    if (fs.existsSync(hookPath)) {
      const content = fs.readFileSync(hookPath, 'utf-8');

      if (content.includes(DEVSPRITE_MARKER)) {
        // Remove our hook section
        const lines = content.split('\n');
        const startIndex = lines.findIndex(l => l.includes(DEVSPRITE_MARKER));
        const endIndex = lines.findIndex(l => l.includes(DEVSPRITE_MARKER + '_END'));

        if (startIndex !== -1 && endIndex !== -1) {
          const newContent = lines
            .slice(0, startIndex)
            .concat(lines.slice(endIndex + 1))
            .join('\n')
            .trim();

          if (newContent.length > 0) {
            fs.writeFileSync(hookPath, newContent, { mode: 0o755 });
          } else {
            fs.unlinkSync(hookPath);
          }

          console.log(`[PostCommitHook] Removed hook from ${hookPath}`);
        }
      }
    }

    console.log(`[PostCommitHook] Stopped`);
  }

  onCommit(callback: (event: CommitEvent) => void): void {
    this.callback = callback;
  }

  /**
   * Handle hook notification (called when hook executes)
   */
  async handleHookNotification(commitHash: string): Promise<void> {
    try {
      console.log(`[PostCommitHook] Handling hook notification for ${commitHash.substring(0, 7)}`);

      // Get commit details using show command for reliability
      const commitInfo = await this.git.show(['--stat', '--format=%H%n%s%n%an%n%aI', commitHash]);
      const lines = commitInfo.split('\n');
      const hash = lines[0]?.trim() || commitHash;
      const message = lines[1]?.trim() || '';
      const author = lines[2]?.trim() || '';
      const dateStr = lines[3]?.trim() || '';

      // Get changed files from diff summary
      const gitUtils = new GitUtils(this.repoPath);
      let changedFiles: string[] = [];
      try {
        changedFiles = await gitUtils.getChangedFiles(commitHash);
      } catch {
        // Fallback: parse from show output
        changedFiles = lines.slice(4).filter(l => l.includes('|')).map(l => l.split('|')[0].trim());
      }

      const event: CommitEvent = {
        repoPath: this.repoPath,
        commitHash: hash,
        commitMessage: message,
        author: author,
        timestamp: dateStr ? new Date(dateStr) : new Date(),
        changedFiles,
      };

      console.log(`[PostCommitHook] Commit detected: ${hash.substring(0, 7)} - ${message}`);

      this.callback?.(event);
    } catch (error) {
      console.error(`[PostCommitHook] Error handling hook notification:`, error);
    }
  }

  private generateHookScript(existingContent: string): string {
    // Escape backslashes for JSON string
    const escapedRepoPath = this.repoPath.replace(/\\/g, '/');
    const hookScript = `#!/bin/sh
${DEVSPRITE_MARKER}
# DevSprite post-commit hook
# This hook is automatically managed by DevSprite
# Do not manually modify between markers

# Get the commit hash
COMMIT_HASH=$(git rev-parse HEAD)

# Notify DevSprite (using HTTP to worker server)
curl -X POST http://localhost:38888/api/git/hook-notify \\
  -H "Content-Type: application/json" \\
  -d "{\\"repoPath\\":\\"${escapedRepoPath}\\",\\"commitHash\\":\\"$COMMIT_HASH\\"}" \\
  --silent --max-time 2 || true

${DEVSPRITE_MARKER}_END

${existingContent.trim()}
`;

    return hookScript;
  }
}
