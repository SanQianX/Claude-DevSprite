/**
 * Database Manager
 * SQLite database operations using sql.js (WASM-based, no native compilation needed)
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { dbPath } from '../config';
import { logger } from '../utils/logger';

export interface Project {
  id: string;
  name: string;
  path: string;
  knowledge_path: string;
  last_analysis_commit: string | null;
  last_full_analysis: string | null;
  analysis_count: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  path: string;
  title: string;
  category: string;
  commit_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface Relation {
  id: number;
  project_id: string;
  source_doc_id: string;
  target_doc_id: string;
  relation_type: string;
  target_is_source: boolean;
  source_file_path: string | null;
  start_line: number | null;
  end_line: number | null;
  description: string | null;
  created_at: string;
}

export interface AnalysisLog {
  id: number;
  project_id: string;
  commit_hash: string;
  commit_message: string | null;
  analysis_mode: string;
  files_changed: number | null;
  model_used: string | null;
  tokens_used: number | null;
  duration_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface LinkIndex {
  id: number;
  project_id: string;
  source_doc_id: string;
  link_url: string;
  link_text: string | null;
  link_type: string;
  resolved_path: string | null;
  is_valid: boolean;
  last_checked: string | null;
}

export class DatabaseManager {
  private db!: SqlJsDatabase;
  private dbPath: string;
  private nextId: number = 1;

  private constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initialize the database (must be called after constructor)
   */
  static async create(): Promise<DatabaseManager> {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const manager = new DatabaseManager(dbPath);

    // Locate the sql.js WASM file
    const wasmPath = path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');
    const SQL = await initSqlJs({
      locateFile: (file: string) => path.join(__dirname, '../../node_modules/sql.js/dist', file),
    });

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      manager.db = new SQL.Database(buffer);
    } else {
      manager.db = new SQL.Database();
    }

    manager.initializeTables();
    logger.info('Database initialized');
    return manager;
  }

  private initializeTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        path        TEXT NOT NULL UNIQUE,
        knowledge_path TEXT NOT NULL,
        last_analysis_commit TEXT,
        last_full_analysis TEXT,
        analysis_count INTEGER DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS documents (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL,
        path        TEXT NOT NULL,
        title       TEXT NOT NULL,
        category    TEXT NOT NULL,
        commit_hash TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        UNIQUE(project_id, path)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS relations (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  TEXT NOT NULL,
        source_doc_id TEXT NOT NULL,
        target_doc_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        target_is_source BOOLEAN DEFAULT 0,
        source_file_path TEXT,
        start_line  INTEGER,
        end_line    INTEGER,
        description TEXT,
        created_at  TEXT NOT NULL,
        FOREIGN KEY (source_doc_id) REFERENCES documents(id),
        FOREIGN KEY (target_doc_id) REFERENCES documents(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS analysis_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        commit_message TEXT,
        analysis_mode TEXT NOT NULL,
        files_changed INTEGER,
        model_used TEXT,
        tokens_used INTEGER,
        duration_ms INTEGER,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at  TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS link_index (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  TEXT NOT NULL,
        source_doc_id TEXT NOT NULL,
        link_url    TEXT NOT NULL,
        link_text   TEXT,
        link_type   TEXT NOT NULL,
        resolved_path TEXT,
        is_valid    BOOLEAN DEFAULT 1,
        last_checked TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_doc_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_doc_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_analysis_log_project ON analysis_log(project_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_link_index_source ON link_index(source_doc_id)`);

    this.save();
    logger.info('Database tables initialized');
  }

  /**
   * Save database to disk
   */
  private save(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  /**
   * Run a query that returns rows
   */
  private queryAll(sql: string, params: any[] = []): any[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  /**
   * Run a query that returns one row
   */
  private queryOne(sql: string, params: any[] = []): any | undefined {
    const results = this.queryAll(sql, params);
    return results.length > 0 ? results[0] : undefined;
  }

  /**
   * Run a statement (INSERT, UPDATE, DELETE)
   */
  private run(sql: string, params: any[] = []): void {
    this.db.run(sql, params);
  }

  // Project operations
  getProjects(): Project[] {
    return this.queryAll('SELECT * FROM projects ORDER BY name') as Project[];
  }

  getProject(name: string): Project | undefined {
    return this.queryOne('SELECT * FROM projects WHERE name = ?', [name]) as Project | undefined;
  }

  getProjectById(id: string): Project | undefined {
    return this.queryOne('SELECT * FROM projects WHERE id = ?', [id]) as Project | undefined;
  }

  getProjectByPath(projectPath: string): Project | undefined {
    return this.queryOne('SELECT * FROM projects WHERE path = ?', [projectPath]) as Project | undefined;
  }

  createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'analysis_count'>): Project {
    const id = this.hashPath(project.path);
    const now = new Date().toISOString();
    this.run(
      `INSERT INTO projects (id, name, path, knowledge_path, last_analysis_commit, last_full_analysis, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, project.name, project.path, project.knowledge_path, project.last_analysis_commit, project.last_full_analysis, now, now]
    );
    this.save();
    return { ...project, id, analysis_count: 0, created_at: now, updated_at: now };
  }

  updateProject(id: string, updates: Partial<Project>): void {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as any)[f]);
    this.run(`UPDATE projects SET ${setClause}, updated_at = ? WHERE id = ?`, [...values, new Date().toISOString(), id]);
    this.save();
  }

  incrementAnalysisCount(id: string): void {
    this.run('UPDATE projects SET analysis_count = analysis_count + 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    this.save();
  }

  deleteProject(id: string): void {
    this.run('DELETE FROM projects WHERE id = ?', [id]);
    this.save();
  }

  // Document operations
  getDocuments(projectId: string): Document[] {
    return this.queryAll('SELECT * FROM documents WHERE project_id = ? ORDER BY category, title', [projectId]) as Document[];
  }

  getDocument(id: string): Document | undefined {
    return this.queryOne('SELECT * FROM documents WHERE id = ?', [id]) as Document | undefined;
  }

  getDocumentByPath(projectId: string, docPath: string): Document | undefined {
    return this.queryOne('SELECT * FROM documents WHERE project_id = ? AND path = ?', [projectId, docPath]) as Document | undefined;
  }

  createDocument(doc: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Document {
    const id = this.hashDocumentId(doc.project_id, doc.path);
    const now = new Date().toISOString();
    this.run(
      `INSERT INTO documents (id, project_id, path, title, category, commit_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, doc.project_id, doc.path, doc.title, doc.category, doc.commit_hash, now, now]
    );
    this.save();
    return { ...doc, id, created_at: now, updated_at: now };
  }

  updateDocument(id: string, updates: Partial<Document>): void {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as any)[f]);
    this.run(`UPDATE documents SET ${setClause}, updated_at = ? WHERE id = ?`, [...values, new Date().toISOString(), id]);
    this.save();
  }

  deleteDocument(id: string): void {
    this.run('DELETE FROM documents WHERE id = ?', [id]);
    this.save();
  }

  deleteDocumentsByProject(projectId: string): void {
    this.run('DELETE FROM documents WHERE project_id = ?', [projectId]);
    this.save();
  }

  // Relation operations
  getRelations(projectId?: string): Relation[] {
    if (projectId) {
      return this.queryAll('SELECT * FROM relations WHERE project_id = ? ORDER BY relation_type', [projectId]) as Relation[];
    }
    return this.queryAll('SELECT * FROM relations ORDER BY relation_type') as Relation[];
  }

  getRelationsForDocument(docId: string): Relation[] {
    return this.queryAll('SELECT * FROM relations WHERE source_doc_id = ? OR target_doc_id = ?', [docId, docId]) as Relation[];
  }

  createRelation(relation: Omit<Relation, 'id' | 'created_at'>): Relation {
    const now = new Date().toISOString();
    this.run(
      `INSERT INTO relations (project_id, source_doc_id, target_doc_id, relation_type, target_is_source, source_file_path, start_line, end_line, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        relation.project_id,
        relation.source_doc_id,
        relation.target_doc_id,
        relation.relation_type,
        relation.target_is_source ? 1 : 0,
        relation.source_file_path,
        relation.start_line,
        relation.end_line,
        relation.description,
        now,
      ]
    );
    // Get the last inserted ID
    const row = this.queryOne('SELECT last_insert_rowid() as id');
    const id = row ? row.id : 0;
    this.save();
    return { ...relation, id, created_at: now };
  }

  deleteRelationsByProject(projectId: string): void {
    this.run('DELETE FROM relations WHERE project_id = ?', [projectId]);
    this.save();
  }

  deleteRelationsForDocument(docId: string): void {
    this.run('DELETE FROM relations WHERE source_doc_id = ? OR target_doc_id = ?', [docId, docId]);
    this.save();
  }

  // Analysis log operations
  getAnalysisLogs(projectId?: string, limit: number = 100): AnalysisLog[] {
    if (projectId) {
      return this.queryAll('SELECT * FROM analysis_log WHERE project_id = ? ORDER BY created_at DESC LIMIT ?', [projectId, limit]) as AnalysisLog[];
    }
    return this.queryAll('SELECT * FROM analysis_log ORDER BY created_at DESC LIMIT ?', [limit]) as AnalysisLog[];
  }

  createAnalysisLog(log: Omit<AnalysisLog, 'id' | 'created_at'>): AnalysisLog {
    const now = new Date().toISOString();
    this.run(
      `INSERT INTO analysis_log (project_id, commit_hash, commit_message, analysis_mode, files_changed, model_used, tokens_used, duration_ms, status, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.project_id,
        log.commit_hash,
        log.commit_message,
        log.analysis_mode,
        log.files_changed,
        log.model_used,
        log.tokens_used,
        log.duration_ms,
        log.status,
        log.error_message,
        now,
      ]
    );
    const row = this.queryOne('SELECT last_insert_rowid() as id');
    const id = row ? row.id : 0;
    this.save();
    return { ...log, id, created_at: now };
  }

  deleteAnalysisLogsByProject(projectId: string): void {
    this.run('DELETE FROM analysis_log WHERE project_id = ?', [projectId]);
    this.save();
  }

  // Link index operations
  getLinkIndex(projectId?: string): LinkIndex[] {
    if (projectId) {
      return this.queryAll('SELECT * FROM link_index WHERE project_id = ?', [projectId]) as LinkIndex[];
    }
    return this.queryAll('SELECT * FROM link_index') as LinkIndex[];
  }

  getLinksForDocument(docId: string): LinkIndex[] {
    return this.queryAll('SELECT * FROM link_index WHERE source_doc_id = ?', [docId]) as LinkIndex[];
  }

  createLinkIndex(link: Omit<LinkIndex, 'id' | 'last_checked'>): LinkIndex {
    const now = new Date().toISOString();
    this.run(
      `INSERT INTO link_index (project_id, source_doc_id, link_url, link_text, link_type, resolved_path, is_valid, last_checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        link.project_id,
        link.source_doc_id,
        link.link_url,
        link.link_text,
        link.link_type,
        link.resolved_path,
        link.is_valid ? 1 : 0,
        now,
      ]
    );
    const row = this.queryOne('SELECT last_insert_rowid() as id');
    const id = row ? row.id : 0;
    this.save();
    return { ...link, id, last_checked: now };
  }

  deleteLinksByProject(projectId: string): void {
    this.run('DELETE FROM link_index WHERE project_id = ?', [projectId]);
    this.save();
  }

  deleteLinksForDocument(docId: string): void {
    this.run('DELETE FROM link_index WHERE source_doc_id = ?', [docId]);
    this.save();
  }

  // Utility
  private hashPath(filePath: string): string {
    return crypto.createHash('sha256').update(filePath).digest('hex').substring(0, 16);
  }

  private hashDocumentId(projectId: string, docPath: string): string {
    return crypto.createHash('sha256').update(projectId + ':' + docPath).digest('hex').substring(0, 16);
  }

  close(): void {
    this.save();
    this.db.close();
    logger.info('Database connection closed');
  }
}

let dbInstance: DatabaseManager | null = null;
let dbInitPromise: Promise<DatabaseManager> | null = null;

export async function getDatabase(): Promise<DatabaseManager> {
  if (dbInstance) {
    return dbInstance;
  }
  if (!dbInitPromise) {
    dbInitPromise = DatabaseManager.create().then((db) => {
      dbInstance = db;
      return db;
    }).catch((err) => {
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbInitPromise = null;
  }
}
