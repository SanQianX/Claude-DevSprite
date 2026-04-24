/**
 * Relation Engine
 * Manages document relationships
 */

import type { Relation, RelationType } from './types';

export class RelationEngine {
  private relations: Map<string, Relation[]> = new Map();

  /**
   * Add a relation
   */
  addRelation(relation: Omit<Relation, 'id' | 'createdAt'>): void {
    const sourceKey = relation.sourceDocId;
    const existing = this.relations.get(sourceKey) || [];
    const newRelation = {
      ...relation,
      id: Date.now(),
      createdAt: new Date(),
    } as Relation;
    this.relations.set(sourceKey, [...existing, newRelation]);
  }

  /**
   * Get outgoing relations from a document
   */
  getOutgoingRelations(docId: string): Relation[] {
    return this.relations.get(docId) || [];
  }

  /**
   * Get incoming relations to a document
   */
  getIncomingRelations(docId: string): Relation[] {
    const incoming: Relation[] = [];
    for (const relations of this.relations.values()) {
      for (const rel of relations) {
        if (rel.targetDocId === docId) {
          incoming.push(rel);
        }
      }
    }
    return incoming;
  }

  /**
   * Delete all relations for a document
   */
  deleteDocumentRelations(docId: string): void {
    this.relations.delete(docId);
    // Remove references from other documents
    for (const [key, relations] of this.relations.entries()) {
      const filtered = relations.filter(r => r.targetDocId !== docId);
      this.relations.set(key, filtered);
    }
  }
}
