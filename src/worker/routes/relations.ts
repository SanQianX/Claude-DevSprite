/**
 * Relations API Routes
 * GET /api/projects/:name/relations
 * GET /api/projects/:name/relations/graph
 */

import type { Express, Request, Response } from 'express';
import { getProjectDiscoveryService } from '../../services/projectDiscovery';
import { getDatabase } from '../db';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('relations');

export function registerRelationRoutes(app: Express): void {
  /**
   * GET /api/projects/:name/relations
   * Get all relations for a project
   */
  app.get('/api/projects/:name/relations', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;
    const { doc } = req.query;

    try {
      const projectDiscovery = getProjectDiscoveryService();
      const project = await projectDiscovery.getProject(name);

      if (!project) {
        throw createError('Project not found', 404);
      }

      const db = await getDatabase();

      let relations;

      if (doc && typeof doc === 'string') {
        // Get relations for a specific document
        const docRecord = db.getDocumentByPath(project.id, doc);
        if (!docRecord) {
          throw createError('Document not found', 404);
        }
        relations = db.getRelationsForDocument(docRecord.id);
      } else {
        // Get all relations for the project
        relations = db.getRelations(project.id);
      }

      res.json({ projectName: name, relations });
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting relations', error);
      throw createError('Failed to get relations', 500, error);
    }
  }));

  /**
   * GET /api/projects/:name/relations/graph
   * Get relation graph data (nodes and edges)
   */
  app.get('/api/projects/:name/relations/graph', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    try {
      const projectDiscovery = getProjectDiscoveryService();
      const project = await projectDiscovery.getProject(name);

      if (!project) {
        throw createError('Project not found', 404);
      }

      const db = await getDatabase();
      const relations = db.getRelations(project.id);
      const documents = db.getDocuments(project.id);

      // Build nodes from documents
      const nodes = documents.map(doc => ({
        id: doc.id,
        label: doc.title,
        path: doc.path,
        category: doc.category,
        type: 'document'
      }));

      // Build edges from relations
      const edges = relations.map(rel => ({
        id: rel.id,
        source: rel.source_doc_id,
        target: rel.target_doc_id,
        label: rel.relation_type,
        type: rel.relation_type
      }));

      res.json({
        projectName: name,
        nodes,
        edges
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting relation graph', error);
      throw createError('Failed to get relation graph', 500, error);
    }
  }));
}
