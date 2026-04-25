/**
 * KnowledgeBaseManager Entry Point
 * Manages knowledge base storage, relations, and git sync
 */

import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import type { Document, DocumentCategory } from './types';
import { StorageManager } from './storageManager';
import { DocumentWriter } from './documentWriter';
import { RelationEngine } from './relationEngine';
import { LinkIndexer } from './linkIndexer';

export class KnowledgeBaseManager {
  private storage: StorageManager;
  private writer: DocumentWriter;
  private relations: RelationEngine;
  private linker: LinkIndexer;
  private initialized = false;

  constructor(private readonly knowledgePath: string) {
    this.storage = new StorageManager(knowledgePath);
    this.writer = new DocumentWriter();
    this.relations = new RelationEngine();
    this.linker = new LinkIndexer();
  }

  /**
   * Initialize knowledge base directory
   */
  async initialize(): Promise<void> {
    if (!fs.existsSync(this.knowledgePath)) {
      fs.mkdirSync(this.knowledgePath, { recursive: true });
    }

    // Ensure README exists
    const readmePath = path.join(this.knowledgePath, 'README.md');
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, '# Knowledge Base\n\nAuto-generated project knowledge base.\n', 'utf-8');
    }

    this.initialized = true;
  }

  /**
   * Write a document to knowledge base
   */
  async writeDocument(doc: Document): Promise<void> {
    await this.ensureInitialized();

    // Write file with frontmatter
    const content = this.writer.writeWithFrontmatter(doc);
    await this.storage.writeFile(doc.path, content);

    // Update relations
    if ((doc as any).relations) {
      for (const rel of (doc as any).relations) {
        this.relations.addRelation({
          projectId: doc.projectId,
          sourceDocId: doc.id,
          targetDocId: rel.targetDocPath,
          relationType: rel.relationType,
          description: rel.description
        });
      }
    }

    // Update link index (extract links from content)
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    const links: Array<{ url: string; text: string }> = [];
    let match;
    while ((match = linkRegex.exec(doc.content)) !== null) {
      links.push({ text: match[1], url: match[2] });
    }
    if (links.length > 0) {
      this.linker.updateIndex(doc.path, links.map((l, i) => ({
        id: i,
        sourceDocId: doc.path,
        linkUrl: l.url,
        linkText: l.text,
        linkType: l.url.startsWith('http') ? 'external' as const
          : l.url.startsWith('#') ? 'anchor' as const
          : l.url.includes('/source?') ? 'source' as const
          : 'knowledge' as const,
        isValid: true
      })));
    }
  }

  /**
   * Read a document from knowledge base
   */
  async readDocument(docPath: string): Promise<Document | null> {
    await this.ensureInitialized();

    try {
      const content = await this.storage.readFile(docPath);
      const { data: meta, content: markdown } = this.writer.parseWithFrontmatter(content);

      return {
        id: meta.id || docPath.replace(/\.md$/, ''),
        projectId: meta.projectId || '',
        path: docPath,
        title: meta.title || path.basename(docPath, '.md'),
        category: (meta.category as DocumentCategory) || 'standard',
        content: markdown,
        createdAt: meta.createdAt ? new Date(meta.createdAt) : new Date(),
        updatedAt: meta.updatedAt ? new Date(meta.updatedAt) : new Date(),
        commitHash: meta.commitHash
      };
    } catch {
      return null;
    }
  }

  /**
   * Delete a document from knowledge base
   */
  async deleteDocument(docPath: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage.deleteFile(docPath);
    this.relations.deleteDocumentRelations(docPath);
    this.linker.invalidateLinks(docPath);
  }

  /**
   * List all documents in knowledge base
   */
  async listDocuments(): Promise<Document[]> {
    await this.ensureInitialized();

    const files = await this.storage.listDir();
    const documents: Document[] = [];

    for (const filePath of files) {
      const doc = await this.readDocument(filePath.replace(/\\/g, '/'));
      if (doc) {
        documents.push(doc);
      }
    }

    return documents;
  }

  /**
   * Get relations for a document
   */
  getRelations(docId: string) {
    return {
      outgoing: this.relations.getOutgoingRelations(docId),
      incoming: this.relations.getIncomingRelations(docId)
    };
  }

  /**
   * Search documents by content
   */
  async search(query: string): Promise<Array<{ path: string; title: string; snippet: string; matches: number }>> {
    await this.ensureInitialized();

    const files = await this.storage.listDir();
    const results: Array<{ path: string; title: string; snippet: string; matches: number }> = [];
    const queryLower = query.toLowerCase();

    for (const filePath of files) {
      try {
        const content = await this.storage.readFile(filePath);
        const { data: meta, content: markdown } = this.writer.parseWithFrontmatter(content);

        const matches = (markdown.toLowerCase().match(new RegExp(queryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        if (matches === 0) continue;

        // Extract snippet
        const lines = markdown.split('\n');
        let snippet = '';
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(queryLower)) {
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length, i + 3);
            snippet = lines.slice(start, end).join('\n').trim();
            break;
          }
        }

        results.push({
          path: filePath.replace(/\\/g, '/'),
          title: meta.title || path.basename(filePath, '.md'),
          snippet: snippet || markdown.substring(0, 200),
          matches
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return results;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

export * from './types';
export * from './storageManager';
export * from './documentWriter';
export * from './relationEngine';
export * from './linkIndexer';
export * from './gitSyncManager';
export * from './conflictResolver';
