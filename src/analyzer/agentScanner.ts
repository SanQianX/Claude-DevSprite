/**
 * Agent Scanner — Two-Level Claude Code CLI Architecture
 *
 * Level 1 (Orchestrator): 轻量协调 Agent
 *   - 读取 tasks/ 设计文档
 *   - 识别问题，创建 issue 目录 + task.md
 *   - 写 summary.md 和 findings.json
 *   - 完成后关闭
 *
 * Level 2 (Worker): 深度分析 Agent
 *   - 在 issue 目录中运行
 *   - 读取 task.md，深入分析
 *   - 写 finding.md / analysis.md / verification.md / fix-suggestion.md
 *   - 完成后关闭
 *   - 后续可用 claude -c 恢复对话继续分析
 */

import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getDatabase } from '../worker/db';
import { createLogger } from '../utils/logger';
import type { DesignFinding, ScannerConfig } from './designScanner';

const logger = createLogger('agent-scanner');

const DEFAULT_SCAN_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const WORKER_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes per worker
const MAX_SKIP_COUNT = 3;
const MAX_ISSUES_PER_SCAN = 10;
const MAX_PARALLEL_WORKERS = 2;

interface AgentConfig {
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

function loadAgentConfig(): AgentConfig {
  const configPath = path.join(os.homedir(), '.claude-dev-sprite', 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const scannerCfg = data.ai?.scanner;
      const globalCfg = data.ai?.aiProvider || data.analysis?.aiProvider || data.server?.aiProvider;
      return {
        model: scannerCfg?.model || globalCfg?.model || 'claude-sonnet-4-6',
        apiKey: scannerCfg?.apiKey || globalCfg?.apiKey,
        baseUrl: scannerCfg?.baseUrl || globalCfg?.baseUrl,
      };
    }
  } catch {
    // ignore
  }
  return { model: 'claude-sonnet-4-6' };
}

function resolveClaudeCLI(): string {
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude'),
    '/usr/local/bin/claude',
    '/usr/bin/claude',
    path.join(os.homedir(), '.local', 'bin', 'claude'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'claude';
}

function buildCleanEnv(agentConfig: AgentConfig): Record<string, string> {
  const excluded = new Set(['CLAUDECODE', 'CLAUDE_CODE_SESSION']);
  const env: Record<string, string> = {};
  for (const [key, val] of Object.entries(process.env)) {
    if (val !== undefined && !excluded.has(key)) {
      env[key] = val;
    }
  }
  if (agentConfig.apiKey) env.ANTHROPIC_API_KEY = agentConfig.apiKey;
  if (agentConfig.baseUrl) env.ANTHROPIC_BASE_URL = agentConfig.baseUrl;
  return env;
}

function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ─── Level 1: Orchestrator Prompt ────────────────────────────────────────────

function buildOrchestratorPrompt(projectPath: string): string {
  return `你是一个代码质量协调 Agent。你的职责是：读设计文档 → 找问题 → 建任务目录 → 派发给子 Agent。

## 你不是分析者，你是协调者

不要自己做深度分析。你的工作是：
1. 读取设计文档，理解"应该是什么样"
2. 快速扫描代码，找出"不一致"的地方
3. 为每个问题创建任务目录和 task.md
4. 汇总统计

## 项目根目录

项目源代码在: ${projectPath}
你需要用绝对路径访问项目文件。

## 第一步：阅读设计文档

用 Read 工具读取（使用绝对路径）：
1. ${projectPath}/tasks/FUNCTIONAL-LOGIC-ANALYSIS.md — 功能排查清单（最重要，逐模块逐项）
2. ${projectPath}/tasks/BUG-HUNTING-PLAN.md — Bug 排查计划
3. ${projectPath}/tasks/COMPONENT-INVENTORY.md — UI 组件清单

## 第二步：快速扫描代码

对每个模块的排查项：
- 用 Grep 在 ${projectPath}/src/ 和 ${projectPath}/web/src/ 中搜索相关 API 路由、函数名、store 变量
- 用 Read 快速查看关键文件
- 重点验证 ⚠️ 标记的未实现项

不要深入分析，只确认"有没有问题"。

## 第三步：为每个问题创建任务目录

**重要：最多创建 ${MAX_ISSUES_PER_SCAN} 个问题目录。发现超过 ${MAX_ISSUES_PER_SCAN} 个问题时，只创建最重要的 ${MAX_ISSUES_PER_SCAN} 个。**

在当前目录（scanteaks/）下创建目录：

### 目录命名
格式: {问题关键词}_{YYYY-MM-DD}/
- 英文小写，连字符分隔，2-4 个核心词
- 今天日期: ${getToday()}
- 示例: missing-task-sync_${getToday()}/

### 每个目录写入 2 个文件

#### 1. task.md

\`\`\`markdown
# {问题标题}

## 基本信息
- **严重程度**: critical/warning/info
- **模块**: {Module 名称}
- **排查项**: {编号，如 2.4}
- **分类**: missing-impl/dead-code/logic-mismatch/api-mismatch/state-mismatch

## 问题描述
{发现了什么不一致}

## 设计文档原文
{摘录 FUNCTIONAL-LOGIC-ANALYSIS.md 中的排查项}

## 需要分析的内容
1. 确认问题：读取相关源代码文件，验证问题确实存在
2. 影响范围：搜索所有相关引用，评估影响
3. 根因分析：分析为什么会出现这个不一致
4. 修复方案：给出具体代码改动方向

## 相关文件提示
- {可能相关的文件路径}
\`\`\`

#### 2. CLAUDE.md（给子 Agent 的工作指南）

\`\`\`markdown
# 问题深度分析工作指南

## 项目信息
- **项目路径**: ${projectPath}
- **问题目录**: 当前目录

## 你的工作流

### 第 1 步：阅读任务描述
读取当前目录的 \`task.md\`，了解要分析的问题。

### 第 2 步：阅读设计文档获取上下文
读取以下设计文档，理解"应该是什么样"：
- ${projectPath}/tasks/FUNCTIONAL-LOGIC-ANALYSIS.md
- ${projectPath}/tasks/BUG-HUNTING-PLAN.md

### 第 3 步：确认问题
- 读取 task.md 中提到的相关源代码文件
- 用 Grep 搜索相关代码
- 确认问题确实存在

### 第 4 步：影响范围分析
- 用 Grep 搜索所有引用该函数/组件/路由的地方
- 评估影响了多少功能

### 第 5 步：根因分析
- 分析为什么会不一致
- 是遗漏？是设计变更没同步？是接口变更没更新？

### 第 6 步：修复方案
- 给出具体的文件和函数修改建议
- 说明修改的先后顺序

### 第 7 步：写入分析结果
在当前目录写入以下 4 个文件：

- \`finding.md\` — 问题描述、严重程度、分类、文件、行号
- \`analysis.md\` — 发现过程、影响范围、根因分析
- \`verification.md\` — 验证结果、预期 vs 实际
- \`fix-suggestion.md\` — 修复方案、涉及文件、修改步骤

## 重要规则
- 使用中文
- file 字段必须指向实际存在的源代码文件
- 分析要深入具体，不要泛泛而谈
- 修复方案要有可操作性
\`\`\`

## 第四步：写 summary.md

在 .claude-devsprite/scanteaks/ 根目录写入 summary.md：

\`\`\`markdown
# 扫描摘要 — ${getToday()}

## 统计
- 排查模块数: N
- 排查检查项数: M
- 发现问题数: X (critical: A, warning: B, info: C)

## 问题列表
| # | 目录 | 标题 | 严重程度 | 模块 | 状态 |
|---|------|------|----------|------|------|
| 1 | {dirName}/ | {title} | {severity} | {module} | 待分析 |

## 未发现问题的模块
- Module X: {名称} — 所有检查项通过
\`\`\`

## 第五步：写 findings.json

\`\`\`json
{
  "date": "${getToday()}",
  "findings": [
    {
      "title": "...",
      "severity": "critical|warning|info",
      "module": "Module 2: AI 审查",
      "checkItem": "2.4",
      "file": "src/xxx.ts",
      "line": 42,
      "category": "missing-impl|dead-code|logic-mismatch|api-mismatch|state-mismatch",
      "description": "...",
      "suggestion": "...",
      "dirName": "missing-task-sync_${getToday()}",
      "status": "pending"
    }
  ],
  "summary": "排查了N个模块的M个检查项，发现X个问题"
}
\`\`\`

## 规则
- 最多创建 ${MAX_ISSUES_PER_SCAN} 个问题目录，优先选择 critical > warning > info
- 只创建你确信存在的问题的任务目录
- 使用中文
- 每个问题目录必须同时创建 task.md 和 CLAUDE.md 两个文件
- task.md 要足够详细，让子 Agent 能独立完成分析
- CLAUDE.md 要包含完整的工作流指引和项目路径信息
- dirName 必须与实际创建的目录名一致`;
}

// ─── Level 2: Worker Prompt ──────────────────────────────────────────────────

function buildWorkerPrompt(issueDir: string): string {
  return `你是一个代码深度分析 Agent。你在问题目录中工作。

## 你的任务

1. 读取当前目录的 task.md — 这是协调 Agent 给你的任务描述
2. 按照 task.md 中"需要分析的内容"逐项执行
3. 将分析结果写入当前目录的 4 个文件

## 分析步骤

### 1. 确认问题
- 读取 task.md 中提到的相关文件
- 用 Grep 搜索相关代码
- 确认问题确实存在

### 2. 影响范围
- 用 Grep 搜索所有引用该函数/组件/路由的地方
- 评估影响了多少功能

### 3. 根因分析
- 分析为什么会不一致
- 是遗漏？是设计变更没同步？是接口变更没更新？

### 4. 修复方案
- 给出具体的文件和函数修改建议
- 说明修改的先后顺序

## 输出文件

### finding.md
\`\`\`markdown
# {问题标题}
- **严重程度**: {从 task.md 复制}
- **模块**: {从 task.md 复制}
- **排查项**: {从 task.md 复制}
- **文件**: {实际问题文件}
- **行号**: {具体行号}
- **分类**: {从 task.md 复制}

## 问题描述
{详细描述}

## 设计文档原文
{从 task.md 复制}
\`\`\`

### analysis.md
\`\`\`markdown
## 发现过程
- **排查模块**: {模块名}
- **排查项**: {排查项描述}
- **验证方法**: {读了哪些文件，搜索了什么关键词}
- **代码证据**: {具体代码行或函数}

## 影响范围
{搜索了哪些引用，影响了哪些功能}

## 根因分析
{为什么会出现这个不一致}
\`\`\`

### verification.md
\`\`\`markdown
## 验证结果
{具体验证过程和结果}

## 预期 vs 实际
- **预期**: {设计文档描述}
- **实际**: {代码实际行为}
\`\`\`

### fix-suggestion.md
\`\`\`markdown
## 推荐修复方案

## 涉及文件
- {file1}: {需要修改的函数/组件}
- {file2}: {需要修改的函数/组件}

## 修改步骤
1. {第一步}
2. {第二步}
3. {第三步}

## 修改方向
{具体的代码改动方向}
\`\`\`

## 规则
- 使用中文
- file 字段必须指向实际存在的源代码文件
- 分析要深入具体，不要泛泛而谈
- 修复方案要有可操作性`;
}

// ─── AgentScanner Class ──────────────────────────────────────────────────────

export interface ProjectScanStatus {
  projectId: string;
  projectName: string;
  scanDir: string;
  startedAt: number;
}

export interface ScannerStatus {
  enabled: boolean;
  intervalMs: number;
  isScanning: boolean;
  activeProjects: ProjectScanStatus[];
  lastScanTime: number | null;
}

export class AgentScanner {
  private scanIntervalMs: number;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private isBatchScanning = false;
  private enabled = true;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private activeScanInfo: Map<string, ProjectScanStatus> = new Map();
  private skipCount: Map<string, number> = new Map();
  private lastScanTime: number | null = null;

  constructor(options?: { scanIntervalMs?: number }) {
    this.scanIntervalMs = options?.scanIntervalMs ?? 10 * 60 * 1000;
  }

  private get isScanning(): boolean {
    // Guard: if isBatchScanning is true but no active projects, reset the flag
    // This handles cases where the flag got stuck (e.g. daemon killed mid-scan)
    if (this.isBatchScanning && this.activeScanInfo.size === 0) {
      this.isBatchScanning = false;
    }
    return this.isBatchScanning || this.activeScanInfo.size > 0;
  }

  getConfig(): ScannerConfig {
    return {
      enabled: this.enabled,
      intervalMs: this.scanIntervalMs,
      isScanning: this.isScanning,
    };
  }

  getScannerStatus(): ScannerStatus {
    return {
      enabled: this.enabled,
      intervalMs: this.scanIntervalMs,
      isScanning: this.isScanning,
      activeProjects: Array.from(this.activeScanInfo.values()),
      lastScanTime: this.lastScanTime,
    };
  }

  updateConfig(config: { enabled?: boolean; intervalMs?: number }): void {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.intervalMs !== undefined && config.intervalMs >= 60000) {
      this.scanIntervalMs = config.intervalMs;
    }
    this.stopScanner();
    if (this.enabled) this.startScanner();
    logger.info(`[AgentScanner] Config updated: enabled=${this.enabled}, interval=${this.scanIntervalMs}ms`);
  }

  startScanner(): void {
    if (this.scanTimer) return;
    if (!this.enabled) {
      logger.info('[AgentScanner] Scanner disabled, not starting');
      return;
    }
    logger.info(`[AgentScanner] Starting background scanner (interval: ${this.scanIntervalMs}ms)`);
    this.scanTimer = setInterval(() => this.scanAllProjects(), this.scanIntervalMs);
    setTimeout(() => this.scanAllProjects(), 30000);
  }

  stopScanner(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
      logger.info('[AgentScanner] Background scanner stopped');
    }
    for (const [, proc] of this.activeProcesses) {
      proc.kill('SIGTERM');
    }
    this.activeProcesses.clear();
    this.activeScanInfo.clear();
    this.skipCount.clear();
  }

  async scanAllProjects(): Promise<void> {
    if (this.isScanning) {
      logger.info('[AgentScanner] Scan already in progress, skipping');
      return;
    }
    this.isBatchScanning = true;
    try {
      const db = await getDatabase();
      const projects = db.getProjects();
      for (const project of projects) {
        try {
          if (this.activeProcesses.has(project.id)) {
            const count = (this.skipCount.get(project.id) || 0) + 1;
            this.skipCount.set(project.id, count);
            if (count >= MAX_SKIP_COUNT) {
              logger.warn(`[AgentScanner] Force-killing stuck scan for "${project.name}"`);
              const proc = this.activeProcesses.get(project.id);
              if (proc) {
                proc.kill('SIGTERM');
                this.activeProcesses.delete(project.id);
                this.activeScanInfo.delete(project.id);
                this.skipCount.delete(project.id);
              }
            } else {
              logger.info(`[AgentScanner] Skipping "${project.name}": scan still running (skip ${count}/${MAX_SKIP_COUNT})`);
              continue;
            }
          }
          await this.scanProject(project.id, project.path, project.name);
        } catch (error: any) {
          logger.error(`[AgentScanner] Error scanning project ${project.name}: ${error.message}`);
        }
      }
    } finally {
      this.isBatchScanning = false;
    }
  }

  async scanProject(projectId: string, projectPath: string, projectName: string): Promise<number> {
    logger.info(`[AgentScanner] Scanning project "${projectName}" at ${projectPath}`);

    const scanteaksBase = path.join(projectPath, '.claude-devsprite', 'scanteaks');
    try {
      fs.mkdirSync(scanteaksBase, { recursive: true });
    } catch (error: any) {
      logger.error(`[AgentScanner] Failed to create scanteaks directory: ${error.message}`);
      return 0;
    }

    // activeScanInfo.set() here — isScanning getter returns true from this point
    this.activeScanInfo.set(projectId, {
      projectId, projectName,
      scanDir: scanteaksBase,
      startedAt: Date.now(),
    });

    try {
      // ─── Phase 1: Orchestrator — 识别问题，创建任务目录 ───
      logger.info(`[AgentScanner] Phase 1: Orchestrator scanning "${projectName}"`);
      const orchestratorResult = await this.spawnOrchestrator(projectId, projectPath, projectName, scanteaksBase, scanteaksBase);

      if (orchestratorResult.killed) {
        logger.warn(`[AgentScanner] Orchestrator timed out for "${projectName}"`);
        return 0;
      }

      // ─── Phase 2: Workers — 为每个问题目录启动子 Agent（最多 MAX_PARALLEL_WORKERS 并行）───
      const issueDirs = this.findIssueDirs(scanteaksBase);
      if (issueDirs.length === 0) {
        logger.info(`[AgentScanner] No issues found for "${projectName}"`);
        return 0;
      }

      logger.info(`[AgentScanner] Phase 2: Spawning ${issueDirs.length} worker(s) for "${projectName}" (max ${MAX_PARALLEL_WORKERS} parallel)`);
      await this.runWorkersWithConcurrencyLimit(
        issueDirs, projectId, projectPath, projectName, scanteaksBase
      );

      // ─── Phase 3: 读取 findings.json 存入 DB ───
      const findingsCount = await this.readAndSaveFindings(projectId, scanteaksBase);
      logger.info(`[AgentScanner] Project "${projectName}": ${findingsCount} findings`);
      return findingsCount;
    } finally {
      // activeScanInfo.delete() here — isScanning stays true until ALL workers complete
      this.activeScanInfo.delete(projectId);
      this.lastScanTime = Date.now();
    }
  }

  // ─── Worker Concurrency Pool ──────────────────────────────────────────────

  /**
   * Run workers with a concurrency limit of MAX_PARALLEL_WORKERS.
   * Starts up to MAX_PARALLEL_WORKERS workers in parallel.
   * When one finishes, starts the next from the queue.
   */
  private async runWorkersWithConcurrencyLimit(
    issueDirs: string[],
    projectId: string,
    projectPath: string,
    projectName: string,
    scanteaksBase: string
  ): Promise<void> {
    const queue = [...issueDirs];
    let nextIndex = 0;

    const runNext = async (): Promise<void> => {
      while (nextIndex < queue.length) {
        const issueDir = queue[nextIndex++];
        const issuePath = path.join(scanteaksBase, issueDir);
        logger.info(`[AgentScanner] Worker starting: ${issueDir} (${queue.length - nextIndex + 1} total, ${queue.length - nextIndex} queued)`);
        await this.spawnWorker(projectId, projectPath, projectName, issuePath);
        logger.info(`[AgentScanner] Worker completed: ${issueDir}`);
      }
    };

    // Start MAX_PARALLEL_WORKERS parallel lanes
    const workers: Promise<void>[] = [];
    const lanes = Math.min(MAX_PARALLEL_WORKERS, queue.length);
    for (let i = 0; i < lanes; i++) {
      workers.push(runNext());
    }
    await Promise.all(workers);
  }

  // ─── Orchestrator (Level 1) ────────────────────────────────────────────────

  private spawnOrchestrator(
    projectId: string,
    projectPath: string,
    projectName: string,
    scanDir: string,
    cwdDir: string
  ): Promise<{ exitCode: number | null; killed: boolean; stderr: string }> {
    const agentConfig = loadAgentConfig();
    const claudePath = resolveClaudeCLI();
    const env = buildCleanEnv(agentConfig);
    const prompt = buildOrchestratorPrompt(projectPath);

    const args = [
      '--dangerously-skip-permissions',
      '--model', agentConfig.model || 'claude-sonnet-4-6',
    ];

    logger.info(`[AgentScanner] Orchestrator: ${claudePath} in ${cwdDir}`);

    return new Promise((resolve) => {
      const child = spawn(claudePath, args, {
        cwd: cwdDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: process.platform === 'win32',
      });

      this.activeProcesses.set(projectId, child);
      let stderr = '';
      let killed = false;

      child.stdout?.on('data', () => {});
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      const timeout = setTimeout(() => {
        killed = true;
        logger.warn(`[AgentScanner] Orchestrator timeout for "${projectName}"`);
        child.kill('SIGTERM');
      }, DEFAULT_SCAN_TIMEOUT_MS);

      child.on('error', (error) => {
        clearTimeout(timeout);
        this.activeProcesses.delete(projectId);
        this.skipCount.delete(projectId);
        logger.error(`[AgentScanner] Orchestrator failed for "${projectName}": ${error.message}`);
        resolve({ exitCode: -1, killed: false, stderr: error.message });
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        this.activeProcesses.delete(projectId);
        this.skipCount.delete(projectId);
        if (killed) {
          logger.warn(`[AgentScanner] Orchestrator killed for "${projectName}"`);
        } else if (code !== 0) {
          logger.error(`[AgentScanner] Orchestrator exited ${code} for "${projectName}"`);
          if (stderr) logger.error(`[AgentScanner] stderr: ${stderr.substring(0, 500)}`);
        }
        resolve({ exitCode: code, killed, stderr });
      });

      child.stdin?.write(prompt);
      child.stdin?.end();
    });
  }

  // ─── Worker (Level 2) ──────────────────────────────────────────────────────

  private spawnWorker(
    projectId: string,
    projectPath: string,
    projectName: string,
    issuePath: string
  ): Promise<{ exitCode: number | null; killed: boolean }> {
    const agentConfig = loadAgentConfig();
    const claudePath = resolveClaudeCLI();
    const env = buildCleanEnv(agentConfig);
    const issueDirName = path.basename(issuePath);
    const prompt = buildWorkerPrompt(issueDirName);

    const args = [
      '--dangerously-skip-permissions',
      '--model', agentConfig.model || 'claude-sonnet-4-6',
    ];

    logger.info(`[AgentScanner] Worker: ${claudePath} in ${issuePath}`);

    return new Promise((resolve) => {
      const child = spawn(claudePath, args, {
        cwd: issuePath,  // 在问题目录中运行
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: process.platform === 'win32',
      });

      let killed = false;

      child.stdout?.on('data', () => {});
      child.stderr?.on('data', () => {});

      const timeout = setTimeout(() => {
        killed = true;
        logger.warn(`[AgentScanner] Worker timeout in "${issueDirName}"`);
        child.kill('SIGTERM');
      }, WORKER_TIMEOUT_MS);

      child.on('error', (error) => {
        clearTimeout(timeout);
        logger.error(`[AgentScanner] Worker failed in "${issueDirName}": ${error.message}`);
        resolve({ exitCode: -1, killed: false });
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (killed) {
          logger.warn(`[AgentScanner] Worker killed in "${issueDirName}"`);
        } else if (code !== 0) {
          logger.error(`[AgentScanner] Worker exited ${code} in "${issueDirName}"`);
        } else {
          logger.info(`[AgentScanner] Worker completed: "${issueDirName}"`);
        }
        resolve({ exitCode: code, killed });
      });

      child.stdin?.write(prompt);
      child.stdin?.end();
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Find issue directories in scanteaks/ (dirs containing task.md)
   */
  private findIssueDirs(scanteaksBase: string): string[] {
    try {
      const entries = fs.readdirSync(scanteaksBase, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory() && fs.existsSync(path.join(scanteaksBase, e.name, 'task.md')))
        .map(e => e.name)
        .sort();
    } catch {
      return [];
    }
  }

  /**
   * Read findings.json and save to DB
   */
  private async readAndSaveFindings(projectId: string, scanDir: string): Promise<number> {
    const findingsPath = path.join(scanDir, 'findings.json');
    try {
      if (!fs.existsSync(findingsPath)) {
        logger.warn(`[AgentScanner] No findings.json at ${findingsPath}`);
        return 0;
      }

      const raw = fs.readFileSync(findingsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed.findings) ? parsed.findings : [];

      const validSeverities = new Set(['critical', 'warning', 'info']);
      const validCategories = new Set(['missing-impl', 'dead-code', 'logic-mismatch', 'api-mismatch', 'state-mismatch']);

      const findings: DesignFinding[] = items.map((f: any) => ({
        file: f.file || '',
        line: f.line || 0,
        severity: validSeverities.has(f.severity) ? f.severity : 'info',
        category: validCategories.has(f.category) ? f.category : 'logic-mismatch',
        title: f.title || '未命名问题',
        description: f.description || '',
        suggestion: f.suggestion || '',
      }));

      if (findings.length > 0) {
        const db = await getDatabase();
        const reviews = findings.map(finding => ({
          project_id: projectId,
          commit_hash: null,
          file_path: finding.file,
          line: finding.line,
          severity: finding.severity,
          category: finding.category,
          title: finding.title,
          description: finding.description,
          suggestion: finding.suggestion || null,
          location: finding.file ? `${finding.file}:${finding.line}` : null,
          source: 'agent-check' as const,
          status: 'pending' as const,
        }));
        db.createReviewsBatch(reviews);
        logger.info(`[AgentScanner] Saved ${findings.length} findings to database`);
      }

      return findings.length;
    } catch (error: any) {
      logger.error(`[AgentScanner] Failed to read findings: ${error.message}`);
      return 0;
    }
  }
}
