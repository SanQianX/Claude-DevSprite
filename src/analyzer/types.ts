/**
 * AI Analysis Engine Types
 */

export type AnalysisMode = 'incremental' | 'full';

export interface DiffEntry {
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  diff?: string;
}

export interface AnalysisContext {
  repoPath: string;
  commitHash: string;
  commitMessage: string;
  mode: AnalysisMode;
  diffs: DiffEntry[];
  previousKnowledge?: string[];
}

export interface GeneratedDocument {
  path: string;
  title: string;
  category: string;
  content: string;
  relations: DocumentRelation[];
}

export interface DocumentRelation {
  targetDocPath: string;
  relationType: 'depends_on' | 'related_to' | 'implements' | 'part_of' | 'source_reference';
  description?: string;
}

export interface AIAnalysisResult {
  documents: GeneratedDocument[];
  modelUsed: string;
  tokensUsed: number;
  durationMs: number;
}

export interface AnalysisConfig {
  maxRetries: number;
  retryBaseDelayMs: number;
}
