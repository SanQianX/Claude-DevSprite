/**
 * Markdown Utilities
 */

import { marked } from 'marked';
import matter from 'gray-matter';

export interface MarkdownMetadata {
  title?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
  commitHash?: string;
  [key: string]: any;
}

export class MarkdownUtils {
  /**
   * Parse markdown with frontmatter
   */
  static parse(content: string): { data: MarkdownMetadata; content: string } {
    return matter(content);
  }

  /**
   * Convert markdown to HTML
   */
  static async toHtml(markdown: string): Promise<string> {
    return await marked.parse(markdown);
  }

  /**
   * Extract title from markdown
   */
  static extractTitle(content: string): string | null {
    // Try frontmatter first
    const { data } = this.parse(content);
    if (data.title) return data.title;

    // Try first heading
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }

  /**
   * Extract all headings
   */
  static extractHeadings(content: string): Array<{
    level: number;
    text: string;
    id: string;
  }> {
    const headings: Array<{ level: number; text: string; id: string }> = [];
    const regex = /^(#{1,6})\s+(.+)$/gm;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      headings.push({ level, text, id });
    }

    return headings;
  }

  /**
   * Extract links from markdown
   */
  static extractLinks(content: string): Array<{
    url: string;
    text: string;
  }> {
    const links: Array<{ url: string; text: string }> = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      links.push({ text: match[1], url: match[2] });
    }

    return links;
  }

  /**
   * Create slug from text
   */
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
