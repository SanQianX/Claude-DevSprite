import * as path from 'path';
import * as os from 'os';

/**
 * Configuration for project discovery.
 * Defines how the system scans for and discovers projects in the file system.
 */
export interface ProjectDiscoveryConfig {
  /** Directories to scan for projects */
  scanPaths: string[];
  /** Patterns to identify project repositories (e.g., presence of .git directory) */
  repoPatterns: string[];
  /** Knowledge directory name within each project */
  knowledgeDirName: string;
  /** Whether to automatically discover projects on system startup */
  autoDiscover: boolean;
  /** Maximum directory depth to scan when searching for projects */
  maxDepth: number;
}

/**
 * Configuration for the server.
 * Defines the network binding parameters for the backend server.
 */
export interface ServerConfig {
  /** Port to listen on */
  port: number;
  /** Host to bind to */
  host: string;
}

/**
 * Configuration for the knowledge base.
 * Controls how the system manages and commits knowledge base updates.
 */
export interface KnowledgeConfig {
  /** Name of the knowledge directory within projects */
  directoryName: string;
  /** Whether to auto-commit knowledge updates */
  autoCommit: boolean;
  /** Template for auto-commit messages */
  commitMessageTemplate: string;
}

/**
 * Configuration for analysis processes.
 * Defines parameters for code analysis, including triggers, limits, and retry behavior.
 */
export interface AnalysisConfig {
  /** Analysis mode: incremental or full */
  mode: 'incremental' | 'full';
  /** Interval in days for full analysis */
  fullAnalysisIntervalDays: number;
  /** Triggers for full analysis */
  fullAnalysisTriggers: {
    /** Threshold of new files to trigger full analysis */
    newFilesThreshold: number;
    /** File patterns for dependency files (e.g., package.json, requirements.txt) */
    dependencyFilePatterns: string[];
    /** Keywords in commit messages to trigger full analysis */
    commitMessageKeywords: string[];
  };
  /** Maximum tokens for diff analysis */
  diffMaxTokens: number;
  /** Maximum retries for analysis operations */
  maxRetries: number;
  /** Base delay in milliseconds for retries */
  retryBaseDelayMs: number;
}

/**
 * Configuration for detection strategies.
 * Defines which strategy to use for detecting file changes (hook, watcher, or poller).
 */
export interface DetectionConfig {
  /** Preferred detection strategy */
  preferredStrategy: 'hook' | 'watcher' | 'poller';
  /** Fallback strategies in order of preference */
  fallbackStrategies: Array<'hook' | 'watcher' | 'poller'>;
  /** Interval in milliseconds for poller strategy */
  pollerIntervalMs: number;
  /** Deduplication window in milliseconds */
  dedupWindowMs: number;
}

/**
 * Configuration for web interface.
 * Controls whether the web UI is enabled and its behavior on startup.
 */
export interface WebConfig {
  /** Whether web interface is enabled */
  enabled: boolean;
  /** Whether to auto-open web interface on startup */
  autoOpen: boolean;
}

/**
 * Configuration for logging.
 * Defines log level and optional log file output.
 */
export interface LoggingConfig {
  /** Logging level */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Optional log file path */
  file?: string;
}

/**
 * Main configuration interface for the system, stored in config.json.
 * This is the top-level structure that contains all sub-configurations.
 */
export interface Config {
  /** Server configuration */
  server: ServerConfig;
  /** Knowledge base configuration */
  knowledge: KnowledgeConfig;
  /** Analysis configuration */
  analysis: AnalysisConfig;
  /** Detection strategy configuration */
  detection: DetectionConfig;
  /** Web interface configuration */
  web: WebConfig;
  /** Logging configuration */
  logging: LoggingConfig;
  /** Project discovery configuration */
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

// Deep merge utility to combine configuration objects
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  return result;
}

// Base directory for DevSprite system data
const baseDataDir: string = path.join(os.homedir(), '.claude-dev-sprite', 'data');

// Database path for structured data (projects, tasks, reviews, etc.)
export const dbPath: string = path.join(baseDataDir, 'dev-sprite.db');

// Configuration file path for system-level settings (JSON)
// IMPORTANT: All references to the config file path must use the same string for consistency.
// The canonical path is: ~/.claude-dev-sprite/config.json
// This is defined here and should be imported from this module when needed.
export const configFile: string = path.join(os.homedir(), '.claude-dev-sprite', 'config.json');

// Ensure data directory exists
try {
  const fs = require('fs');
  if (!fs.existsSync(baseDataDir)) {
    fs.mkdirSync(baseDataDir, { recursive: true });
  }
} catch (error) {
  // Ignore errors during initialization
}

// Load configuration with priority: Environment variables > Config file > Default values
// 1. Start with default configuration (which includes environment variables)
const defaultConfig = getDefaultConfig();

// 2. Attempt to load configuration from config file and merge with defaults
let fileConfig: Partial<Config> = {};
try {
  const fs = require('fs');
  if (fs.existsSync(configFile)) {
    const configData = fs.readFileSync(configFile, 'utf-8');
    fileConfig = JSON.parse(configData);
  }
} catch (error) {
  // If file reading fails, use empty config to fall back to defaults
  // Optional: log error for debugging, but do not throw to avoid breaking startup
  console.warn(`Failed to load config file ${configFile}: ${error}. Using defaults.`);
}

// 3. Merge configuration: default config as base, file config overrides
export const config: Config = deepMerge(defaultConfig, fileConfig);