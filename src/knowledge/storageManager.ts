/**
 * Storage Manager
 * Handles file system operations for knowledge base
 */

import fs from 'fs/promises';
import path from 'path';

export class StorageManager {
  constructor(private readonly basePath: string) {}

  /**
   * Ensure directory exists
   */
  async ensureDir(dirPath: string): Promise<void> {
    const fullPath = path.join(this.basePath, dirPath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  /**
   * Write file with directory creation
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  /**
   * Read file
   */
  async readFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.basePath, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    await fs.unlink(fullPath);
  }

  /**
   * List directory recursively
   */
  async listDir(dirPath: string = ''): Promise<string[]> {
    const fullPath = path.join(this.basePath, dirPath);
    const entries: string[] = [];

    async function walk(currentPath: string, relativePath: string): Promise<void> {
      const items = await fs.readdir(currentPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(currentPath, item.name);
        const itemRelative = path.join(relativePath, item.name);

        if (item.isDirectory()) {
          await walk(itemPath, itemRelative);
        } else if (item.isFile() && item.name.endsWith('.md')) {
          entries.push(itemRelative);
        }
      }
    }

    await walk(fullPath, dirPath);
    return entries;
  }
}
