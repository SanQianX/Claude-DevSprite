import * as path from 'path';
import * as os from 'os';

export interface ProjectDiscoveryConfig {
  /** Directories to scan for projects */
  scanPaths: string[];
  /** Patterns to identify project repositories */
  repoPatterns: string[];
  /** Knowledge directory name within each project */
  knowledgeDirName: string;
  /** Auto-discover on startup */
  autoDiscover: boolean;
  /** Maximum scan depth */
  maxDepth: number;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface KnowledgeConfig {
  directoryName: string;
  autoCommit: boolean;
  commitMessageTemplate: string;
}

export interface AnalysisConfig {
  mode: 'incremental' | 'full';
  fullAnalysisIntervalDays: number;
  fullAnalysisTriggers: {
    newFilesThreshold: number;
    dependencyFilePatterns: string[];
    commitMessageKeywords: string[];
  };
  diffMaxTokens: number;
  maxRetries: number;
  retryBaseDelayMs: number;
}

export interface DetectionConfig {
  preferredStrategy: 'hook' | 'watcher' | 'poller';
  fallbackStrategies: Array<'hook' | 'watcher' | 'poller'>;
  pollerIntervalMs: number;
  dedupWindowMs: number;
}

export interface WebConfig {
  enabled: boolean;
  autoOpen: boolean;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  file?: string;
}

export interface Config {
  server: ServerConfig;
  knowledge: KnowledgeConfig;
  analysis: AnalysisConfig;
  detection: DetectionConfig;
  web: WebConfig;
  logging: LoggingConfig;
  projectDiscovery: ProjectDiscoveryConfig;
}

const getDefaultConfig = (): Config => ({
  server: {
    port: parseInt(process.env.PORT || '38888', 10),
    host: process.env.HOST || 'localhost',
  },
  knowledge: {
    directoryName: 'knowledge',
    autoCommit: false,
    commitMessageTemplate: 'docs(knowledge): update knowledge base [auto]',
  },
  analysis: {
    mode: 'incremental',
    fullAnalysisIntervalDays: 30,
    fullAnalysisTriggers: {
      newFilesThreshold: 10,
      dependencyFilePatterns: ['package.json', 'requirements.txt', 'Cargo.toml', 'go.mod'],
      commitMessageKeywords: ['[major]', '[breaking]', '[architecture]', '[refactor]'],
    },
    diffMaxTokens: 8000,
    maxRetries: 3,
    retryBaseDelayMs: 1000,
  },
  detection: {
    preferredStrategy: 'hook',
    fallbackStrategies: ['watcher', 'poller'],
    pollerIntervalMs: 5000,
    dedupWindowMs: 5000,
  },
  web: {
    enabled: true,
    autoOpen: false,
  },
  logging: {
    level: 'info',
    file: path.join(os.homedir(), '.claude-dev-sprite', 'logs', 'app.log'),
  },
  projectDiscovery: {
    // Default scan paths: common project directories
    // Include the parent of this config file's location (the project root) for reliable discovery
    scanPaths: [
      process.cwd(),
      // Add parent directory of dist/ (project root when running from dist)
      path.resolve(__dirname, '..', '..'),
      path.join(os.homedir(), 'Projects'),
      path.join(os.homedir(), 'code'),
      path.join(os.homedir(), 'dev'),
      path.join(os.homedir(), 'workspace'),
    ].filter((p, i, arr) => {
      // Deduplicate and filter non-existent paths
      if (arr.indexOf(p) !== i) return false;
      try {
        return require('fs').existsSync(p);
      } catch {
        return false;
      }
    }),
    repoPatterns: ['.git'], // Look for .git directory
    knowledgeDirName: 'knowledge',
    autoDiscover: true,
    maxDepth: 3,
  },
});

// Default configuration
export const config: Config = getDefaultConfig();

// Base directory for DevSprite system data
const baseDataDir: string = path.join(os.homedir(), '.claude-dev-sprite', 'data');

// Database path for structured data (projects, tasks, reviews, etc.)
export const dbPath: string = path.join(baseDataDir, 'dev-sprite.db');

// Configuration file path for system-level settings (JSON)
// Updated to match actual implementation as per review: ~/.claude/claude-dev-sprite/data/config.json
export const configFile: string = path.join(os.homedir(), '.claude', 'claude-dev-sprite', 'data', 'config.json');

// Ensure data directory exists
try {
  const fs = require('fs');
  if (!fs.existsSync(baseDataDir)) {
    fs.mkdirSync(baseDataDir, { recursive: true });
  }
} catch (error) {
  // Ignore errors during initialization
}