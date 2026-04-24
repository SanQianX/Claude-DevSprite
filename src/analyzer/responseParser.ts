/**
 * AI Response Parser
 * Parses AI responses into structured data
 */

import matter from 'gray-matter';
import type { GeneratedDocument } from './types';

export class ResponseParser {
  /**
   * Parse AI response JSON
   */
  parseResponse(response: string): GeneratedDocument[] {
    try {
      // Try to extract JSON from the response (might be wrapped in markdown code blocks)
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : response;

      const parsed = JSON.parse(jsonContent);
      const documents = parsed.documents || [];

      // Validate and normalize documents
      return documents.map((doc: any) => this.normalizeDocument(doc));
    } catch (error) {
      console.error('[ResponseParser] Failed to parse AI response:', error);
      console.error('[ResponseParser] Response content:', response);
      return [];
    }
  }

  /**
   * Normalize document structure
   */
  private normalizeDocument(doc: any): GeneratedDocument {
    return {
      path: doc.path || `untitled/${Date.now()}.md`,
      title: doc.title || 'Untitled Document',
      category: doc.category || 'general',
      content: doc.content || '',
      relations: Array.isArray(doc.relations) ? doc.relations : [],
    };
  }

  /**
   * Extract document metadata from content
   */
  extractMetadata(content: string): { title: string; category: string } {
    try {
      const { data } = matter(content);
      return {
        title: data.title || 'Untitled',
        category: data.category || 'general',
      };
    } catch (error) {
      // Try to extract title from markdown heading
      const headingMatch = content.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        return {
          title: headingMatch[1].trim(),
          category: 'general',
        };
      }

      return {
        title: 'Untitled',
        category: 'general',
      };
    }
  }

  /**
   * Extract relations from document content
   */
  extractRelations(content: string): GeneratedDocument['relations'] {
    const relations: GeneratedDocument['relations'] = [];

    // Look for relation patterns like [[document-path]] or [[document-path|label]]
    const wikiLinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let match;

    while ((match = wikiLinkPattern.exec(content)) !== null) {
      relations.push({
        targetDocPath: match[1],
        relationType: 'related_to',
        description: match[2] || undefined,
      });
    }

    return relations;
  }
}
