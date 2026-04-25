/**
 * User prompt submit hook
 * Intercepts /kb commands to trigger knowledge base operations
 */

import { getDatabase } from '../worker/db';
import { getProjectDiscoveryService } from '../services/projectDiscovery';
import { createLogger } from '../utils/logger';

const logger = createLogger('userPromptSubmit');

export async function onUserPromptSubmit(command: string): Promise<string | null> {
  if (!command.startsWith('/kb')) {
    return null;
  }

  const parts = command.trim().split(/\s+/);
  const subCommand = parts[1] || 'help';

  switch (subCommand) {
    case 'status': {
      return handleStatus();
    }
    case 'analyze': {
      const projectName = parts[2];
      if (!projectName) {
        return 'Usage: /kb analyze <project-name>\nUse /kb status to see available projects.';
      }
      return `Analysis triggered for project: ${projectName}. Check the Web Dashboard for progress.`;
    }
    case 'help':
    default: {
      return `Knowledge Base Commands:
  /kb status          - Show all projects and their status
  /kb analyze <name>  - Trigger analysis for a project
  /kb help            - Show this help message

The Web Dashboard is available at http://localhost:38888`;
    }
  }
}

async function handleStatus(): Promise<string> {
  try {
    const discovery = getProjectDiscoveryService();
    const projects = await discovery.getAllProjects();

    if (projects.length === 0) {
      return 'No projects discovered yet. The system will auto-discover Git repositories.';
    }

    const lines = ['Knowledge Base Status:', '─'.repeat(50)];
    for (const project of projects) {
      lines.push(`  Project: ${project.name}`);
      lines.push(`  Path: ${project.path}`);
      lines.push(`  Knowledge: ${project.knowledgePath}`);
      lines.push(`  Analyses: ${project.analysisCount}`);
      if (project.lastAnalysisCommit) {
        lines.push(`  Last Commit: ${project.lastAnalysisCommit.substring(0, 7)}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  } catch (error) {
    logger.error('Failed to get status', error);
    return 'Error: Failed to retrieve project status.';
  }
}
