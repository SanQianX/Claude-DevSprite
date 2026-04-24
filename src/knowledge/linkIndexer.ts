/**
 * Link Indexer
 * Maintains index of links for faster navigation
 */

export interface LinkEntry {
  id: number;
  sourceDocId: string;
  linkUrl: string;
  linkText?: string;
  linkType: 'knowledge' | 'source' | 'anchor' | 'external';
  resolvedPath?: string;
  isValid: boolean;
  lastChecked?: Date;
}

export class LinkIndexer {
  private index: Map<string, LinkEntry[]> = new Map();

  /**
   * Update link index for a document
   */
  updateIndex(docId: string, links: LinkEntry[]): void {
    this.index.set(docId, links);
  }

  /**
   * Get link index for a document
   */
  getIndex(docId: string): LinkEntry[] {
    return this.index.get(docId) || [];
  }

  /**
   * Find links pointing to a specific target
   */
  findLinksToTarget(targetPath: string): LinkEntry[] {
    const results: LinkEntry[] = [];
    for (const links of this.index.values()) {
      for (const link of links) {
        if (link.resolvedPath === targetPath) {
          results.push(link);
        }
      }
    }
    return results;
  }

  /**
   * Invalidate links that no longer exist
   */
  invalidateLinks(docId: string): void {
    const links = this.index.get(docId) || [];
    const updated = links.map(l => ({ ...l, isValid: false }));
    this.index.set(docId, updated);
  }
}
