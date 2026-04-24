/**
 * Document Writer
 * Writes documents with frontmatter and templates
 */

import type { Document } from './types';
import matter from 'gray-matter';

export class DocumentWriter {
  /**
   * Write document with frontmatter
   */
  writeWithFrontmatter(doc: Document): string {
    const frontmatter = {
      title: doc.title,
      category: doc.category,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      ...(doc.commitHash && { commitHash: doc.commitHash }),
    };

    const matterContent = matter.stringify(doc.content, frontmatter);
    return matterContent;
  }

  /**
   * Parse document with frontmatter
   */
  parseWithFrontmatter(content: string): { data: any; content: string } {
    return matter(content);
  }
}
