/**
 * Teams API Unit Tests
 * Tests for team routes without external dependencies
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TeamConfigManager } from '../../src/teams/teamConfig';
import { TeamManager } from '../../src/teams/teamManager';

describe('Teams API Logic', () => {
  let tempDir: string;
  let configManager: TeamConfigManager;
  let teamManager: TeamManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teams-api-test-'));
    configManager = new TeamConfigManager(tempDir);
    teamManager = new TeamManager(tempDir);
    await configManager.initialize();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Team Configuration Loading', () => {
    it('should load all team configurations', async () => {
      const teams = [];
      for (const teamName of ['lead', 'dev', 'test'] as const) {
        const config = await configManager.load(teamName);
        teams.push(config);
      }

      expect(teams.length).toBe(3);
      expect(teams[0].name).toBe('lead');
      expect(teams[1].name).toBe('dev');
      expect(teams[2].name).toBe('test');
    });

    it('should load team configuration with correct model', async () => {
      const leadConfig = await configManager.load('lead');
      const devConfig = await configManager.load('dev');
      const testConfig = await configManager.load('test');

      expect(leadConfig.model).toBeDefined();
      expect(devConfig.model).toBeDefined();
      expect(testConfig.model).toBeDefined();
    });

    it('should load team configuration with correct allowedTools', async () => {
      const leadConfig = await configManager.load('lead');
      const devConfig = await configManager.load('dev');
      const testConfig = await configManager.load('test');

      // Lead should have read-only tools
      expect(leadConfig.allowedTools).toContain('Read');
      expect(leadConfig.allowedTools).toContain('Glob');
      expect(leadConfig.allowedTools).toContain('Grep');
      expect(leadConfig.allowedTools).not.toContain('Write');

      // Dev should have write tools
      expect(devConfig.allowedTools).toContain('Read');
      expect(devConfig.allowedTools).toContain('Write');
      expect(devConfig.allowedTools).toContain('Edit');

      // Test should have test tools
      expect(testConfig.allowedTools).toContain('Read');
      expect(testConfig.allowedTools).toContain('Bash(npm test)');
    });
  });

  describe('Team Status Management', () => {
    it('should return initial idle status for all teams', async () => {
      const leadStatus = teamManager.getTeamStatus('lead');
      const devStatus = teamManager.getTeamStatus('dev');
      const testStatus = teamManager.getTeamStatus('test');

      expect(leadStatus.status).toBe('idle');
      expect(devStatus.status).toBe('idle');
      expect(testStatus.status).toBe('idle');
    });

    it('should return all team statuses', async () => {
      const statuses = teamManager.getAllStatuses();

      expect(statuses.length).toBe(3);
      expect(statuses.map(s => s.name)).toContain('lead');
      expect(statuses.map(s => s.name)).toContain('dev');
      expect(statuses.map(s => s.name)).toContain('test');
    });
  });

  describe('Team Configuration Update', () => {
    it('should update team configuration', async () => {
      const originalConfig = await configManager.load('dev');
      expect(originalConfig.model).not.toBe('claude-opus-4-20250514');

      // Update config
      const updatedConfig = {
        ...originalConfig,
        model: 'claude-opus-4-20250514',
        maxTurns: 30,
      };
      await configManager.save('dev', updatedConfig);

      // Verify update
      const loadedConfig = await configManager.load('dev');
      expect(loadedConfig.model).toBe('claude-opus-4-20250514');
      expect(loadedConfig.maxTurns).toBe(30);
    });
  });

  describe('Team Abort Operations', () => {
    it('should abort team execution without error', async () => {
      // This should not throw
      teamManager.abortTeam('lead');
      teamManager.abortTeam('dev');
      teamManager.abortTeam('test');
    });

    it('should abort all teams without error', async () => {
      // This should not throw
      teamManager.abortAll();
    });
  });

  describe('Team Connectivity Test', () => {
    it('should test team connectivity by loading config', async () => {
      const config = await configManager.load('lead');

      expect(config).toBeDefined();
      expect(config.name).toBe('lead');
      expect(config.model).toBeDefined();
    });
  });
});
