/**
 * API Routes Integration Tests
 * Tests for GATE-8: API endpoint responses
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TeamConfigManager } from '../../../src/teams/teamConfig';
import { TeamManager } from '../../../src/teams/teamManager';
import type { TeamName } from '../../../src/teams/types';

describe('API Routes Logic (GATE-8)', () => {
  let tempDir: string;
  let configManager: TeamConfigManager;
  let teamManager: TeamManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-routes-test-'));
    configManager = new TeamConfigManager(tempDir);
    teamManager = new TeamManager(tempDir);
    await configManager.initialize();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('GET /api/teams logic', () => {
    it('should return all team configurations', async () => {
      const teams = [];
      for (const name of ['lead', 'dev', 'test'] as TeamName[]) {
        const config = await configManager.load(name);
        teams.push(config);
      }

      expect(teams).toHaveLength(3);
      expect(teams.map(t => t.name)).toEqual(['lead', 'dev', 'test']);
    });

    it('should include model for each team', async () => {
      for (const name of ['lead', 'dev', 'test'] as TeamName[]) {
        const config = await configManager.load(name);
        expect(config.model).toBeDefined();
        expect(typeof config.model).toBe('string');
      }
    });

    it('should include allowedTools for each team', async () => {
      for (const name of ['lead', 'dev', 'test'] as TeamName[]) {
        const config = await configManager.load(name);
        expect(Array.isArray(config.allowedTools)).toBe(true);
        expect(config.allowedTools.length).toBeGreaterThan(0);
      }
    });
  });

  describe('GET /api/teams/:name logic', () => {
    it('should return lead config', async () => {
      const config = await configManager.load('lead');
      expect(config.name).toBe('lead');
      expect(config.allowedTools).toContain('Read');
      expect(config.allowedTools).not.toContain('Write');
    });

    it('should return dev config', async () => {
      const config = await configManager.load('dev');
      expect(config.name).toBe('dev');
      expect(config.allowedTools).toContain('Read');
      expect(config.allowedTools).toContain('Write');
      expect(config.allowedTools).toContain('Edit');
    });

    it('should return test config', async () => {
      const config = await configManager.load('test');
      expect(config.name).toBe('test');
      expect(config.allowedTools).toContain('Read');
      expect(config.allowedTools).toContain('Bash(npm test)');
    });
  });

  describe('PUT /api/teams/:name logic', () => {
    it('should update team model', async () => {
      const original = await configManager.load('dev');
      const updated = { ...original, model: 'claude-opus-4-20250514' };
      await configManager.save('dev', updated);

      const loaded = await configManager.load('dev');
      expect(loaded.model).toBe('claude-opus-4-20250514');
    });

    it('should update team maxTurns', async () => {
      const original = await configManager.load('dev');
      const updated = { ...original, maxTurns: 50 };
      await configManager.save('dev', updated);

      const loaded = await configManager.load('dev');
      expect(loaded.maxTurns).toBe(50);
    });

    it('should update team allowedTools', async () => {
      const original = await configManager.load('dev');
      const updated = { ...original, allowedTools: ['Read', 'Write', 'Edit', 'Bash'] };
      await configManager.save('dev', updated);

      const loaded = await configManager.load('dev');
      expect(loaded.allowedTools).toContain('Bash');
    });
  });

  describe('GET /api/teams/:name/status logic', () => {
    it('should return idle status for team', () => {
      const status = teamManager.getTeamStatus('dev');
      expect(status.name).toBe('dev');
      expect(status.status).toBe('idle');
    });

    it('should return idle for all teams', () => {
      for (const name of ['lead', 'dev', 'test'] as TeamName[]) {
        const status = teamManager.getTeamStatus(name);
        expect(status.status).toBe('idle');
      }
    });
  });

  describe('GET /api/teams/status/all logic', () => {
    it('should return all team statuses', () => {
      const statuses = teamManager.getAllStatuses();
      expect(statuses).toHaveLength(3);
      expect(statuses.map(s => s.name)).toEqual(['lead', 'dev', 'test']);
    });

    it('should all be idle initially', () => {
      const statuses = teamManager.getAllStatuses();
      statuses.forEach(s => expect(s.status).toBe('idle'));
    });
  });

  describe('POST /api/teams/:name/test logic', () => {
    it('should verify team config exists', async () => {
      const config = await configManager.load('lead');
      expect(config).toBeDefined();
      expect(config.name).toBe('lead');
    });
  });

  describe('POST /api/teams/:name/abort logic', () => {
    it('should not throw when aborting idle team', () => {
      expect(() => teamManager.abortTeam('dev')).not.toThrow();
    });
  });

  describe('POST /api/teams/abort-all logic', () => {
    it('should not throw when aborting all teams', () => {
      expect(() => teamManager.abortAll()).not.toThrow();
    });
  });
});
