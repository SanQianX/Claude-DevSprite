/**
 * Path Utilities
 */

import { join, relative, normalize, resolve, sep } from 'path';

export class PathUtils {
  /**
   * Join paths safely
   */
  static join(...paths: string[]): string {
    return join(...paths);
  }

  /**
   * Get relative path from base
   */
  static relative(from: string, to: string): string {
    return relative(from, to);
  }

  /**
   * Normalize path
   */
  static normalize(path: string): string {
    return normalize(path);
  }

  /**
   * Resolve to absolute path
   */
  static resolve(...paths: string[]): string {
    return resolve(...paths);
  }

  /**
   * Check if path is absolute
   */
  static isAbsolute(path: string): boolean {
    return resolve(path) === normalize(path);
  }

  /**
   * Get path separator
   */
  static get separator(): string {
    return sep;
  }

  /**
   * Ensure path ends with separator
   */
  static ensureTrailingSeparator(path: string): string {
    return path.endsWith(sep) ? path : path + sep;
  }
}
