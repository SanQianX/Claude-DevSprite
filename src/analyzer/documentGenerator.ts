/**
 * Document Generator
 * Generates structured knowledge base documents
 */

import matter from 'gray-matter';
import type { GeneratedDocument } from './types';
import { ResponseParser } from './responseParser';

export class DocumentGenerator {
  private responseParser: ResponseParser;

  constructor() {
    this.responseParser = new ResponseParser();
  }

  /**
   * Generate documents from AI response
   */
  generateDocuments(aiResponse: string): GeneratedDocument[] {
    const documents = this.responseParser.parseResponse(aiResponse);
    return documents.map(doc => this.applyTemplate(doc));
  }

  /**
   * Apply document template with frontmatter
   */
  applyTemplate(doc: GeneratedDocument): GeneratedDocument {
    const frontmatter = {
      title: doc.title,
      category: doc.category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      relations: doc.relations,
    };

    const matterContent = matter.stringify(doc.content, frontmatter);

    return {
      ...doc,
      content: matterContent,
    };
  }

  /**
   * Generate a document path based on category and title
   */
  generateDocumentPath(category: string, title: string): string {
    const sanitizedTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return `${category}/${sanitizedTitle}.md`;
  }

  /**
   * Merge documents with existing ones
   */
  mergeWithExisting(
    existingDocs: Map<string, string>,
    newDocs: GeneratedDocument[]
  ): GeneratedDocument[] {
    return newDocs.map(newDoc => {
      const existingContent = existingDocs.get(newDoc.path);

      if (existingContent) {
        // Parse existing document
        const { data, content } = matter(existingContent);

        // Merge content (append new content)
        const mergedContent = `${content}\n\n---\n\n${newDoc.content}`;

        // Update metadata
        const mergedFrontmatter = {
          ...data,
          updatedAt: new Date().toISOString(),
        };

        const mergedMatter = matter.stringify(mergedContent, mergedFrontmatter);

        return {
          ...newDoc,
          content: mergedMatter,
        };
      }

      return newDoc;
    });
  }
}
