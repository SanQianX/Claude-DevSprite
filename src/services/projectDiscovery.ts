/**
 * Project Discovery Service
 * Discovers and manages Git repositories with knowledge bases
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getDatabase } from '../worker/db';

export interface DiscoveredProject {
  /** Project name (derived from directory name) */
  name: string;
  /** Absolute path to project root */
  path: string;
  /** Absolute path to knowledge directory */
  knowledgePath: string;
  /** Whether this is a Git repository */
  isGitRepo: boolean;
  /** Last modified time */
  lastModified?: Date;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  knowledgePath: string;
  description?: string;
  lastAnalysisCommit?: string;
  lastFullAnalysis?: Date;
  analysisCount: number;
  createdAt: Date;
  updatedAt: Date;
  documentCount?: number;
  lastUpdated?: string;
  color?: string;
}

/**
 * Project Discovery Service
 */
export class ProjectDiscoveryService {
  private discoveredProjects = new Map<string, DiscoveredProject>();
  private scanInProgress = false;

  /**
   * Discover projects in configured scan paths
   */
  async discoverProjects(): Promise<DiscoveredProject[]> {
    if (this.scanInProgress) {
      logger.debug('Project scan already in progress, skipping');
      return Array.from(this.discoveredProjects.values());
    }

    this.scanInProgress = true;
    const projects: DiscoveredProject[] = [];

    try {
      logger.info('Starting project discovery...');

      for (const scanPath of config.projectDiscovery.scanPaths) {
        if (!fs.existsSync(scanPath)) {
          logger.debug(`Scan path does not exist: ${scanPath}`);
          continue;
        }

        const foundProjects = await this.scanDirectory(scanPath, 0);
        projects.push(...foundProjects);
      }

      // Update cache
      this.discoveredProjects.clear();
      for (const project of projects) {
        this.discoveredProjects.set(project.path, project);
      }

      logger.info(`Project discovery completed: found ${projects.length} projects`);

      // Auto-register discovered projects in database
      await this.registerDiscoveredProjects(projects);

      return projects;
    } catch (error) {
      logger.error('Error during project discovery', error);
      throw error;
    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * Get all discovered projects
   */
  getDiscoveredProjects(): DiscoveredProject[] {
    return Array.from(this.discoveredProjects.values());
  }

  /**
   * Get a specific discovered project by path
   */
  getProjectByPath(projectPath: string): DiscoveredProject | undefined {
    return this.discoveredProjects.get(projectPath);
  }

  /**
   * Check if a path is a valid project
   */
  isProject(projectPath: string): boolean {
    return this.discoveredProjects.has(projectPath);
  }

  /**
   * Manually add a project
   */
  async addProject(projectPath: string): Promise<DiscoveredProject> {
    const normalizedPath = path.resolve(projectPath);

    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`Project path does not exist: ${normalizedPath}`);
    }

    const knowledgePath = path.join(normalizedPath, config.knowledge.directoryName);

    if (!fs.existsSync(knowledgePath)) {
      // Create knowledge directory if it doesn't exist
      fs.mkdirSync(knowledgePath, { recursive: true });
      logger.info(`Created knowledge directory: ${knowledgePath}`);
    }

    const project: DiscoveredProject = {
      name: path.basename(normalizedPath),
      path: normalizedPath,
      knowledgePath,
      isGitRepo: this.isGitRepository(normalizedPath),
      lastModified: this.getLastModified(knowledgePath),
    };

    this.discoveredProjects.set(normalizedPath, project);
    await this.registerDiscoveredProjects([project]);

    return project;
  }

  /**
   * Scan a directory for projects recursively
   */
  private async scanDirectory(dirPath: string, currentDepth: number): Promise<DiscoveredProject[]> {
    const projects: DiscoveredProject[] = [];

    if (currentDepth >= config.projectDiscovery.maxDepth) {
      return projects;
    }

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      // Check if current directory is a project
      const isRepo = this.isGitRepository(dirPath);
      const hasKnowledge = fs.existsSync(path.join(dirPath, config.knowledge.directoryName));

      if (isRepo || hasKnowledge) {
        // Create knowledge directory if it doesn't exist in a Git repo
        const knowledgePath = path.join(dirPath, config.knowledge.directoryName);
        if (isRepo && !hasKnowledge) {
          fs.mkdirSync(knowledgePath, { recursive: true });
        }

        projects.push({
          name: path.basename(dirPath),
          path: dirPath,
          knowledgePath,
          isGitRepo: isRepo,
          lastModified: hasKnowledge ? this.getLastModified(knowledgePath) : undefined,
        });

        // Don't recurse into projects (they may contain nested repos)
        return projects;
      }

      // Recurse into subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);

          // Skip common non-project directories
          if (this.shouldSkipDirectory(entry.name)) {
            continue;
          }

          const subProjects = await this.scanDirectory(fullPath, currentDepth + 1);
          projects.push(...subProjects);
        }
      }
    } catch (error) {
      logger.debug(`Error scanning directory ${dirPath}:`, error);
    }

    return projects;
  }

  /**
   * Check if a directory is a Git repository
   */
  private isGitRepository(dirPath: string): boolean {
    return fs.existsSync(path.join(dirPath, '.git'));
  }

  /**
   * Get last modified time of a directory
   */
  private getLastModified(dirPath: string): Date | undefined {
    try {
      let latest = 0;

      const scanDir = (currentPath: string) => {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          const stats = fs.statSync(fullPath);

          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else {
            if (stats.mtime.getTime() > latest) {
              latest = stats.mtime.getTime();
            }
          }
        }
      };

      scanDir(dirPath);
      return latest > 0 ? new Date(latest) : undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Check if a directory should be skipped during scanning
   */
  private shouldSkipDirectory(name: string): boolean {
    const skipPatterns = [
      'node_modules',
      '.git',
      '.cache',
      'dist',
      'build',
      'target',
      'bin',
      'obj',
      '__pycache__',
      '.venv',
      'venv',
      'env',
      '.idea',
      '.vscode',
    ];

    return skipPatterns.includes(name) || name.startsWith('.');
  }

  /**
   * Register discovered projects in the database
   */
  private async registerDiscoveredProjects(projects: DiscoveredProject[]): Promise<void> {
    const db = await getDatabase();

    for (const project of projects) {
      // Check if project already exists
      const existing = db.getProjectByPath(project.path);

      if (!existing) {
        // Create new project record
        db.createProject({
          name: project.name,
          path: project.path,
          knowledge_path: project.knowledgePath,
          last_analysis_commit: null,
          last_full_analysis: null,
        });
        logger.info(`Registered new project: ${project.name} at ${project.path}`);
      } else {
        // Update existing project if knowledge path changed
        if (existing.knowledge_path !== project.knowledgePath) {
          db.updateProject(existing.id, { knowledge_path: project.knowledgePath });
          logger.debug(`Updated project knowledge path: ${project.name}`);
        }
      }
    }
  }

  /**
   * Get all projects from database with enhanced info
   */
  async getAllProjects(): Promise<ProjectInfo[]> {
    const db = await getDatabase();
    const projects = db.getProjects();

    return projects.map(project => {
      const discovered = this.getProjectByPath(project.path);
      const color = this.generateProjectColor(project.name);
      const documentCount = this.countMarkdownFiles(project.knowledge_path);
      const lastUpdated = this.getLastUpdated(project.knowledge_path);

      return {
        id: project.id,
        name: project.name,
        path: project.path,
        knowledgePath: project.knowledge_path,
        description: discovered?.isGitRepo ? 'Git repository' : 'Local project',
        lastAnalysisCommit: project.last_analysis_commit || undefined,
        lastFullAnalysis: project.last_full_analysis ? new Date(project.last_full_analysis) : undefined,
        analysisCount: project.analysis_count || 0,
        createdAt: new Date(project.created_at),
        updatedAt: new Date(project.updated_at),
        documentCount,
        lastUpdated,
        color,
      };
    });
  }

  /**
   * Get a specific project by name
   */
  async getProject(name: string): Promise<ProjectInfo | undefined> {
    const db = await getDatabase();
    const project = db.getProject(name);

    if (!project) {
      return undefined;
    }

    const discovered = this.getProjectByPath(project.path);
    const color = this.generateProjectColor(project.name);
    const documentCount = this.countMarkdownFiles(project.knowledge_path);
    const lastUpdated = this.getLastUpdated(project.knowledge_path);

    return {
      id: project.id,
      name: project.name,
      path: project.path,
      knowledgePath: project.knowledge_path,
      description: discovered?.isGitRepo ? 'Git repository' : 'Local project',
      lastAnalysisCommit: project.last_analysis_commit || undefined,
      lastFullAnalysis: project.last_full_analysis ? new Date(project.last_full_analysis) : undefined,
      analysisCount: project.analysis_count || 0,
      createdAt: new Date(project.created_at),
      updatedAt: new Date(project.updated_at),
      documentCount,
      lastUpdated,
      color,
    };
  }

  /**
   * Remove a project from the system (does NOT delete local files)
   */
  async removeProject(name: string): Promise<void> {
    const db = await getDatabase();
    const project = db.getProject(name);

    if (!project) {
      throw new Error(`Project not found: ${name}`);
    }

    // Delete all related data from DB
    db.deleteDocumentsByProject(project.id);
    db.deleteRelationsByProject(project.id);
    db.deleteAnalysisLogsByProject(project.id);
    db.deleteLinksByProject(project.id);
    db.deleteProject(project.id);

    // Remove from in-memory cache
    this.discoveredProjects.delete(project.path);

    logger.info(`Removed project from system: ${name} (${project.path})`);
  }

  /**
   * Generate a consistent color for a project name
   */
  private generateProjectColor(name: string): string {
    const colors = [
      '#E74C3C', // Red
      '#E67E22', // Orange
      '#F1C40F', // Yellow
      '#2ECC71', // Green
      '#1ABC9C', // Teal
      '#3498DB', // Blue
      '#9B59B6', // Purple
      '#E91E63', // Pink
      '#00BCD4', // Cyan
      '#FF5722', // Deep Orange
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Count markdown files in a directory
   */
  private countMarkdownFiles(dirPath: string): number {
    let count = 0;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          count += this.countMarkdownFiles(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          count++;
        }
      }
    } catch (error) {
      // Ignore errors for directories we can't read
    }

    return count;
  }

  /**
   * Get last updated date of a directory
   */
  private getLastUpdated(dirPath: string): string | undefined {
    const lastModified = this.getLastModified(dirPath);
    return lastModified?.toISOString();
  }

  /**
   * Refresh project discovery (rescan all paths)
   */
  async refresh(): Promise<DiscoveredProject[]> {
    logger.info('Refreshing project discovery...');
    return this.discoverProjects();
  }
}

// Singleton instance
let instance: ProjectDiscoveryService | null = null;

export function getProjectDiscoveryService(): ProjectDiscoveryService {
  if (!instance) {
    instance = new ProjectDiscoveryService();
  }
  return instance;
}
