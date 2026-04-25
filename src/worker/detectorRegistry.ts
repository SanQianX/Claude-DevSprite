/**
 * Shared detector state registry
 * Avoids circular dependency between server.ts and routes/git.ts
 */

import { CommitDetectorManager } from '../detectors';

interface ProjectDetectorEntry {
  projectName: string;
  detector: CommitDetectorManager;
  repoPath: string;
}

const projectDetectors = new Map<string, ProjectDetectorEntry>();

export function registerProjectDetector(projectName: string, detector: CommitDetectorManager, repoPath: string): void {
  projectDetectors.set(projectName, { projectName, detector, repoPath });
}

export function getAllProjectDetectors(): Map<string, ProjectDetectorEntry> {
  return projectDetectors;
}

export function getProjectDetector(projectName: string): CommitDetectorManager | null {
  return projectDetectors.get(projectName)?.detector || null;
}
