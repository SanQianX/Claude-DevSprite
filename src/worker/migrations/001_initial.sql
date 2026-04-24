-- Initial database schema
-- Run this to create the database tables

-- 1. Projects table
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
);

-- 2. Documents table
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
);

-- 3. Relations table
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
);

-- 4. Analysis log table
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
);

-- 5. Link index table
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
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_doc_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_doc_id);
CREATE INDEX IF NOT EXISTS idx_analysis_log_project ON analysis_log(project_id, commit_hash);
CREATE INDEX IF NOT EXISTS idx_link_index_doc ON link_index(source_doc_id);
