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

export interface Task {
  id: number;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  estimated: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Review {
  id: number;
  project_id: string;
  title: string;
  severity: string;
  location: string | null;
  suggestion: string | null;
  source: string;
  status: string;
  commit_hash: string | null;
  file_path: string | null;
  line: number | null;
  category: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
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

    // Tasks table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  TEXT NOT NULL,
        title       TEXT NOT NULL,
        description TEXT,
        status      TEXT NOT NULL DEFAULT 'backlog',
        priority    TEXT DEFAULT 'medium',
        estimated   TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // Reviews table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  TEXT NOT NULL,
        title       TEXT NOT NULL,
        severity    TEXT NOT NULL DEFAULT 'LOW',
        location    TEXT,
        suggestion  TEXT,
        source      TEXT DEFAULT 'manual',
        status      TEXT NOT NULL DEFAULT 'pending',
        commit_hash TEXT,
        file_path   TEXT,
        line        INTEGER,
        category    TEXT,
        description TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        resolved_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // Migration: add new columns to existing reviews table
    const reviewColumns = this.queryAll("PRAGMA table_info(reviews)") as any[];
    const reviewColNames = new Set(reviewColumns.map((c: any) => c.name));
    const newReviewCols = [
      { name: 'commit_hash', type: 'TEXT' },
      { name: 'file_path', type: 'TEXT' },
      { name: 'line', type: 'INTEGER' },
      { name: 'category', type: 'TEXT' },
      { name: 'description', type: 'TEXT' },
    ];
    for (const col of newReviewCols) {
      if (!reviewColNames.has(col.name)) {
        try {
          this.db.run(`ALTER TABLE reviews ADD COLUMN ${col.name} ${col.type}`);
        } catch { /* column already exists */ }
      }
    }

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_reviews_project ON reviews(project_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_analysis_log_project_created ON analysis_log(project_id, created_at)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_reviews_project_status ON reviews(project_id, status)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_reviews_project_created ON reviews(project_id, created_at)`);

    // Session summaries table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS session_summaries (
        session_id  TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        summary     TEXT,
        key_topics  TEXT,
        decisions   TEXT,
        action_items TEXT,
        created_at  TEXT NOT NULL
      )
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_session_summaries_project ON session_summaries(project_name)`);

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
    const ALLOWED = new Set(['name', 'path', 'knowledge_path', 'last_analysis_commit', 'last_full_analysis', 'analysis_count']);
    const fields = Object.keys(updates).filter(k => k !== 'id' && ALLOWED.has(k));
    if (fields.length === 0) return;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as Record<string, unknown>)[f]);
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
    const ALLOWED = new Set(['project_id', 'path', 'title', 'category', 'commit_hash']);
    const fields = Object.keys(updates).filter(k => k !== 'id' && ALLOWED.has(k));
    if (fields.length === 0) return;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as Record<string, unknown>)[f]);
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

  // Task operations
  getTasks(projectId: string): Task[] {
    return this.queryAll('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC', [projectId]) as Task[];
  }

  getTask(id: number): Task | undefined {
    return this.queryOne('SELECT * FROM tasks WHERE id = ?', [id]) as Task | undefined;
  }

  createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>): Task {
    const now = new Date().toISOString();
    this.run(
      `INSERT INTO tasks (project_id, title, description, status, priority, estimated, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [task.project_id, task.title, task.description, task.status, task.priority, task.estimated, now, now]
    );
    const row = this.queryOne('SELECT last_insert_rowid() as id');
    const id = row ? row.id : 0;
    this.save();
    return { ...task, id, created_at: now, updated_at: now, completed_at: null };
  }

  updateTask(id: number, updates: Partial<Task>): void {
    const ALLOWED = new Set(['title', 'description', 'status', 'priority', 'estimated', 'completed_at']);
    const fields = Object.keys(updates).filter(k => k !== 'id' && ALLOWED.has(k));
    if (fields.length === 0) return;
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as Record<string, unknown>)[f]);
    this.run(`UPDATE tasks SET ${setClause}, updated_at = ? WHERE id = ?`, [...values, new Date().toISOString(), id]);
    this.save();
  }

  deleteTask(id: number): void {
    this.run('DELETE FROM tasks WHERE id = ?', [id]);
    this.save();
  }

  // Review operations
  getReviews(projectId: string): Review[] {
    return this.queryAll('SELECT * FROM reviews WHERE project_id = ? ORDER BY created_at DESC', [projectId]) as Review[];
  }

  getPendingReviews(projectId: string): Review[] {
    return this.queryAll('SELECT * FROM reviews WHERE project_id = ? AND status = ? ORDER BY created_at DESC', [projectId, 'pending']) as Review[];
  }

  getReview(id: number): Review | undefined {
    return this.queryOne('SELECT * FROM reviews WHERE id = ?', [id]) as Review | undefined;
  }

  createReview(review: Omit<Review, 'id' | 'created_at' | 'updated_at' | 'resolved_at'>): Review {
    const now = new Date().toISOString();
    this.run(
      `INSERT INTO reviews (project_id, title, severity, location, suggestion, source, status, commit_hash, file_path, line, category, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [review.project_id, review.title, review.severity, review.location || null, review.suggestion || null, review.source || 'ai', review.status, review.commit_hash || null, review.file_path || null, review.line || null, review.category || null, review.description || null, now, now]
    );
    const row = this.queryOne('SELECT last_insert_rowid() as id');
    const id = row ? row.id : 0;
    this.save();
    return { ...review, id, created_at: now, updated_at: now, resolved_at: null };
  }

  updateReview(id: number, updates: Partial<Review>): void {
    const ALLOWED = new Set(['title', 'severity', 'location', 'suggestion', 'source', 'status', 'commit_hash', 'file_path', 'line', 'category', 'description', 'resolved_at']);
    const fields = Object.keys(updates).filter(k => k !== 'id' && ALLOWED.has(k));
    if (fields.length === 0) return;
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as Record<string, unknown>)[f]);
    this.run(`UPDATE reviews SET ${setClause}, updated_at = ? WHERE id = ?`, [...values, new Date().toISOString(), id]);
    this.save();
  }

  deleteReview(id: number): void {
    this.run('DELETE FROM reviews WHERE id = ?', [id]);
    this.save();
  }

  getLatestReviewCommit(projectId: string): string | null {
    const row = this.queryOne(
      'SELECT commit_hash FROM reviews WHERE project_id = ? AND commit_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1',
      [projectId]
    );
    return row ? row.commit_hash : null;
  }

  updateLastReviewCommit(projectId: string, commitHash: string): void {
    // Store in a simple key-value style using the projects table
    this.run(
      `UPDATE projects SET last_analysis_commit = ? WHERE id = ?`,
      [commitHash, projectId]
    );
    this.save();
  }

  // Session summary operations
  getRecentSessions(projectId: string, limit: number = 10): any[] {
    try {
      return this.queryAll(
        'SELECT id, title, created_at FROM sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT ?',
        [projectId, limit]
      );
    } catch {
      return [];
    }
  }

  saveSessionSummary(sessionId: string, projectName: string, summary: string, keyTopics: string[], decisions: string[], actionItems: string[]): void {
    this.run(
      `INSERT OR REPLACE INTO session_summaries (session_id, project_name, summary, key_topics, decisions, action_items, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, projectName, summary, JSON.stringify(keyTopics), JSON.stringify(decisions), JSON.stringify(actionItems), new Date().toISOString()]
    );
    this.save();
  }

  getSessionSummary(sessionId: string): any {
    return this.queryOne('SELECT * FROM session_summaries WHERE session_id = ?', [sessionId]);
  }

  // Transaction support
  beginTransaction(): void {
    this.db.run('BEGIN TRANSACTION');
  }

  commit(): void {
    this.db.run('COMMIT');
    this.save();
  }

  rollback(): void {
    this.db.run('ROLLBACK');
  }

  /**
   * Batch create reviews inside a transaction (used by codeReviewer/designChecker)
   * Uses raw run() instead of createReview() to avoid save() calling db.export()
   * which interferes with the active SQL transaction in sql.js.
   */
  createReviewsBatch(reviews: Array<Omit<Review, 'id' | 'created_at' | 'updated_at' | 'resolved_at'>>): void {
    this.beginTransaction();
    try {
      for (const review of reviews) {
        const now = new Date().toISOString();
        this.run(
          `INSERT INTO reviews (project_id, title, severity, location, suggestion, source, status, commit_hash, file_path, line, category, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [review.project_id, review.title, review.severity, review.location || null, review.suggestion || null, review.source || 'ai', review.status, review.commit_hash || null, review.file_path || null, review.line || null, review.category || null, review.description || null, now, now]
        );
      }
      this.commit();
    } catch (err) {
      this.rollback();
      throw err;
    }
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

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbInitPromise = null;
  }
}
