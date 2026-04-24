/**
 * Knowledge Base Types
 */

export type DocumentCategory = 'feature' | 'overview' | 'architecture' | 'module' | 'standard' | 'test' | 'changelog';

export type RelationType = 'depends_on' | 'related_to' | 'implements' | 'part_of' | 'source_reference';

export interface Document {
  id: string;
  projectId: string;
  path: string;
  title: string;
  category: DocumentCategory;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  commitHash?: string;
}

export interface Relation {
  id?: number;
  projectId: string;
  sourceDocId: string;
  targetDocId: string;
  relationType: RelationType;
  targetIsSource?: boolean;
  sourceFilePath?: string;
  startLine?: number;
  endLine?: number;
  description?: string;
  createdAt: Date;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  knowledgePath: string;
  lastAnalysisCommit?: string;
  lastFullAnalysis?: Date;
  analysisCount: number;
  createdAt: Date;
  updatedAt: Date;
}
