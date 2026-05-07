/**
 * TeamConfig Unit Tests
 * Tests for configuration loading and saving
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TeamConfigManager } from '../../src/teams/teamConfig';
import type { TeamName } from '../../src/teams/types';

describe('TeamConfigManager', () => {
  let configManager: TeamConfigManager;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'team-config-test-'));
    configManager = new TeamConfigManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('initialize()', () => {
    it('should create .Claude-DevSprite directory structure', async () => {
      await configManager.initialize();

      // Check if directories exist
      const baseDir = path.join(tempDir, '.Claude-DevSprite');
      const teamsDir = path.join(baseDir, 'teams');

      await expect(fs.access(teamsDir)).resolves.toBeUndefined();
      await expect(fs.access(path.join(teamsDir, 'lead'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(teamsDir, 'dev', 'inbox'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(teamsDir, 'dev', 'outbox'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(teamsDir, 'test', 'inbox'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(teamsDir, 'test', 'outbox'))).resolves.toBeUndefined();
    });

    it('should create default config files', async () => {
      await configManager.initialize();

      // Check if config files exist
      const baseDir = path.join(tempDir, '.Claude-DevSprite');
      const leadConfig = path.join(baseDir, 'teams', 'lead', 'config.json');
      const devConfig = path.join(baseDir, 'teams', 'dev', 'config.json');
      const testConfig = path.join(baseDir, 'teams', 'test', 'config.json');

      await expect(fs.access(leadConfig)).resolves.toBeUndefined();
      await expect(fs.access(devConfig)).resolves.toBeUndefined();
      await expect(fs.access(testConfig)).resolves.toBeUndefined();
    });
  });

  describe('load()', () => {
    it('should load lead team config with defaults', async () => {
      await configManager.initialize();

      const config = await configManager.load('lead');

      expect(config.name).toBe('lead');
      expect(config.model).toBeDefined();
      expect(config.allowedTools).toContain('Read');
      expect(config.allowedTools).toContain('Glob');
      expect(config.allowedTools).toContain('Grep');
    });

    it('should load dev team config with defaults', async () => {
      await configManager.initialize();

      const config = await configManager.load('dev');

      expect(config.name).toBe('dev');
      expect(config.model).toBeDefined();
      expect(config.allowedTools).toContain('Read');
      expect(config.allowedTools).toContain('Write');
      expect(config.allowedTools).toContain('Edit');
    });

    it('should load test team config with defaults', async () => {
      await configManager.initialize();

      const config = await configManager.load('test');

      expect(config.name).toBe('test');
      expect(config.model).toBeDefined();
      expect(config.allowedTools).toContain('Read');
      expect(config.allowedTools).toContain('Bash(npm test)');
    });

    it('should throw error for missing model in config', async () => {
      await configManager.initialize();

      // Write invalid config
      const invalidConfig = { name: 'lead', allowedTools: [] };
      const configPath = path.join(tempDir, '.Claude-DevSprite', 'teams', 'lead', 'config.json');
      await fs.writeFile(configPath, JSON.stringify(invalidConfig));

      await expect(configManager.load('lead')).rejects.toThrow('model is required');
    });
  });

  describe('save()', () => {
    it('should save team config', async () => {
      await configManager.initialize();

      const config = {
        name: 'lead' as TeamName,
        displayName: 'Test Lead',
        model: 'claude-opus-4-20250514',
        maxTurns: 20,
        allowedTools: ['Read', 'Write'],
        timeout: 300000,
      };

      await configManager.save('lead', config);

      // Load and verify
      const loaded = await configManager.load('lead');
      expect(loaded.model).toBe('claude-opus-4-20250514');
      expect(loaded.maxTurns).toBe(20);
      expect(loaded.displayName).toBe('Test Lead');
    });
  });

  describe('loadGlobalSettings()', () => {
    it('should load default global settings', async () => {
      await configManager.initialize();

      const settings = await configManager.loadGlobalSettings();

      expect(settings.version).toBeDefined();
      expect(settings.teams).toBeDefined();
      expect(settings.teams.lead).toBeDefined();
      expect(settings.teams.dev).toBeDefined();
      expect(settings.teams.test).toBeDefined();
    });
  });

  describe('saveGlobalSettings()', () => {
    it('should save global settings', async () => {
      await configManager.initialize();

      const settings = {
        version: '1.0.0',
        projectName: 'test-project',
        teams: {
          lead: { enabled: true, displayName: 'Lead', description: 'Lead team' },
          dev: { enabled: true, displayName: 'Dev', description: 'Dev team' },
          test: { enabled: true, displayName: 'Test', description: 'Test team' },
        },
        communication: {
          protocol: 'file-based' as const,
          pollInterval: 5000,
          taskTimeout: 600000,
        },
        knowledge: {
          autoUpdateOnCommit: true,
          knowledgePath: '.Claude-DevSprite/knowledge',
          developmentPath: '.Claude-DevSprite/development',
        },
      };

      await configManager.saveGlobalSettings(settings);

      // Load and verify
      const loaded = await configManager.loadGlobalSettings();
      expect(loaded.version).toBe('1.0.0');
      expect(loaded.projectName).toBe('test-project');
    });
  });
});
