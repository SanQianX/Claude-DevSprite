/**
 * Design Scanner Agent
 *
 * 独立的设计扫描器模块，用于扫描代码与设计文档的一致性。
 * 现在完全委托给 AgentScanner（Claude Code CLI Agent 模式）。
 * Agent 在项目目录中自主探索整个代码库，发现架构级问题，
 * 将结果写入 .claude-devsprite/scanteaks/ 目录。
 *
 * 职责：
 * - 委托 AgentScanner 执行实际扫描
 * - 管理扫描器生命周期和配置
 * - 不自动修复或提交
 */

import { createLogger } from '../utils/logger';
import { AgentScanner, type ScannerStatus } from './agentScanner';

const logger = createLogger('design-scanner');

export interface DesignFinding {
  file: string;
  line: number;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  suggestion?: string;
}

export interface DesignCheckResult {
  findings: DesignFinding[];
  summary: string;
  filesReviewed: number;
  modelUsed: string;
}

export interface ScannerConfig {
  enabled: boolean;
  intervalMs: number;
  isScanning: boolean;
}

/**
 * DesignScanner 类
 *
 * 设计扫描器，完全委托给 AgentScanner（Claude Code CLI Agent 模式）。
 * Agent 在项目目录中自主探索整个代码库，发现架构级问题。
 */
export class DesignScanner {
  private agentScanner: AgentScanner;

  /**
   * 创建 DesignScanner 实例
   * @param options - 可选配置：scanIntervalMs（扫描间隔毫秒）
   */
  constructor(options?: { model?: string; scanIntervalMs?: number; agentConfig?: any }) {
    this.agentScanner = new AgentScanner({ scanIntervalMs: options?.scanIntervalMs });
  }

  getConfig(): ScannerConfig {
    return this.agentScanner.getConfig();
  }

  getScannerStatus(): ScannerStatus {
    return this.agentScanner.getScannerStatus();
  }

  updateConfig(config: { enabled?: boolean; intervalMs?: number }): void {
    this.agentScanner.updateConfig(config);
  }

  startScanner(): void {
    this.agentScanner.startScanner();
  }

  stopScanner(): void {
    this.agentScanner.stopScanner();
  }

  async scanAllProjects(): Promise<void> {
    return this.agentScanner.scanAllProjects();
  }

  async scanProject(projectId: string, projectPath: string, projectName: string): Promise<number> {
    logger.info(`[DesignScanner] Delegating scan for "${projectName}" to AgentScanner`);
    return this.agentScanner.scanProject(projectId, projectPath, projectName);
  }
}

/**
 * Shared singleton scanner instance.
 * All modules (worker/index.ts, reviews.ts, etc.) must use this
 * to ensure activeScanInfo and isScanning state is shared.
 */
let _sharedScanner: DesignScanner | null = null;

export function getSharedScanner(options?: { scanIntervalMs?: number }): DesignScanner {
  if (!_sharedScanner) {
    _sharedScanner = new DesignScanner(options);
  }
  return _sharedScanner;
}

export function resetSharedScanner(): void {
  if (_sharedScanner) {
    _sharedScanner.stopScanner();
    _sharedScanner = null;
  }
}
