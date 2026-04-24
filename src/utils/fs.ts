/**
 * File System Utilities
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { join, extname, basename, dirname, relative } from 'path';

export class FsUtils {
  /**
   * Read file with error handling
   */
  static async safeReadFile(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Write file with directory creation
   */
  static async writeFile(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf-8');
  }

  /**
   * Check if file exists
   */
  static async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List directory recursively
   */
  static async listDirRecursive(
    dir: string,
    filter?: (path: string, stat: any) => boolean
  ): Promise<string[]> {
    const results: string[] = [];

    async function walk(currentPath: string, root: string): Promise<void> {
      const entries = await readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        const statInfo = await stat(fullPath);

        if (entry.isDirectory()) {
          await walk(fullPath, root);
        } else if (!filter || filter(fullPath, statInfo)) {
          results.push(relative(root, fullPath));
        }
      }
    }

    await walk(dir, dir);
    return results;
  }

  /**
   * Get file extension
   */
  static getExtension(path: string): string {
    return extname(path).toLowerCase();
  }

  /**
   * Get file name without extension
   */
  static getFileName(path: string): string {
    return basename(path, extname(path));
  }
}
