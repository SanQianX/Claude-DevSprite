/**
 * Team Configuration Manager
 * Handles reading/writing team configurations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type { TeamConfig, TeamName, GlobalSettings } from './types';

const logger = createLogger('team-config');

const DEFAULT_CONFIGS: Record<TeamName, TeamConfig> = {
  lead: {
    name: 'lead',
    displayName: 'Lead 协调者',
    model: 'mimo-v2.5',
    maxTurns: 15,
    allowedTools: ['Read', 'Glob', 'Grep', 'WebSearch'],
    timeout: 600000,
    skills: [],
  },
  dev: {
    name: 'dev',
    displayName: '开发团队',
    model: 'mimo-v2.5',
    maxTurns: 20,
    allowedTools: ['Read', 'Write', 'Edit', 'Bash(npm:*)', 'Bash(npx:*)', 'Bash(git:*)'],
    disallowedTools: ['Bash(rm *)', 'Bash(git push --force)'],
    timeout: 600000,
    skills: [],
  },
  test: {
    name: 'test',
    displayName: '测试团队',
    model: 'mimo-v2.5',
    maxTurns: 15,
    allowedTools: ['Read', 'Glob', 'Grep', 'Bash(npm test)', 'Bash(npx vitest:*)', 'Bash(npx playwright:*)'],
    timeout: 600000,
    skills: ['playwright'],
    skillConfig: {
      playwright: {
        browser: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
      },
    },
  },
};

export class TeamConfigManager {
  private basePath: string;

  constructor(projectPath: string) {
    this.basePath = path.join(projectPath, '.Claude-DevSprite');
  }

  /**
   * Load team configuration
   */
  async load(teamName: TeamName): Promise<TeamConfig> {
    const configPath = path.join(this.basePath, 'teams', teamName, 'config.json');

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as TeamConfig;

      // Validate required fields
      if (!config.model) {
        throw new Error(`model is required in team config: ${teamName}`);
      }

      logger.info(`Loaded config for team: ${teamName}`);
      return config;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn(`Config not found for team: ${teamName}, using defaults`);
        return DEFAULT_CONFIGS[teamName];
      }
      throw error;
    }
  }

  /**
   * Save team configuration
   */
  async save(teamName: TeamName, config: TeamConfig): Promise<void> {
    const configDir = path.join(this.basePath, 'teams', teamName);
    const configPath = path.join(configDir, 'config.json');

    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    logger.info(`Saved config for team: ${teamName}`);
  }

  /**
   * Load global settings
   */
  async loadGlobalSettings(): Promise<GlobalSettings> {
    const settingsPath = path.join(this.basePath, 'settings.json');

    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      return JSON.parse(content) as GlobalSettings;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn('Global settings not found, using defaults');
        return this.getDefaultGlobalSettings();
      }
      throw error;
    }
  }

  /**
   * Save global settings
   */
  async saveGlobalSettings(settings: GlobalSettings): Promise<void> {
    const settingsPath = path.join(this.basePath, 'settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    logger.info('Saved global settings');
  }

  /**
   * Initialize .Claude-DevSprite directory structure
   */
  async initialize(): Promise<void> {
    const dirs = [
      'teams/lead',
      'teams/dev/inbox',
      'teams/dev/outbox',
      'teams/test/inbox',
      'teams/test/outbox',
      'knowledge',
      'development',
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.basePath, dir), { recursive: true });
    }

    // Save default configs if not exist
    for (const teamName of ['lead', 'dev', 'test'] as TeamName[]) {
      const configPath = path.join(this.basePath, 'teams', teamName, 'config.json');
      try {
        await fs.access(configPath);
      } catch {
        await this.save(teamName, DEFAULT_CONFIGS[teamName]);
      }
    }

    // Save default global settings if not exist
    const settingsPath = path.join(this.basePath, 'settings.json');
    try {
      await fs.access(settingsPath);
    } catch {
      await this.saveGlobalSettings(this.getDefaultGlobalSettings());
    }

    logger.info('Initialized .Claude-DevSprite directory structure');
  }

  private getDefaultGlobalSettings(): GlobalSettings {
    return {
      version: '0.2.0',
      projectName: 'my-app',
      teams: {
        lead: {
          enabled: true,
          displayName: 'Lead 协调者',
          description: '分析需求、拆解任务、协调团队',
        },
        dev: {
          enabled: true,
          displayName: '开发团队',
          description: '编写代码、实现功能',
        },
        test: {
          enabled: true,
          displayName: '测试团队',
          description: '编写测试、UI 测试、截图验证',
        },
      },
      communication: {
        protocol: 'file-based',
        pollInterval: 3000,
        taskTimeout: 300000,
      },
      knowledge: {
        autoUpdateOnCommit: true,
        knowledgePath: '.Claude-DevSprite/knowledge',
        developmentPath: '.Claude-DevSprite/development',
      },
    };
  }
}
