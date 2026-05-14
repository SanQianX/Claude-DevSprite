/**
 * Agent Fixer — Two-Level Claude Code CLI Architecture for Auto-Fix
 *
 * Architecture (Orchestrator 常驻 + Worker 串行):
 *
 *   Orchestrator (长生命周期, 常驻)
 *     │
 *     ├── Phase 1: 创建修复任务目录 (task.md + CLAUDE.md)
 *     │
 *     ├── Phase 2: 串行管理 Worker 生命周期
 *     │     ├── 启动 Worker 1 → 等待完成/超时 → 关闭 Worker 1
 *     │     ├── 启动 Worker 2 → 等待完成/超时 → 关闭 Worker 2
 *     │     └── ...
 *     │
 *     └── 关闭
 *
 *   Worker (短生命周期, 一次修复一个问题)
 *     ├── 读取 CLAUDE.md + task.md
 *     ├── 修复前测试 (Playwright 截图 / curl)
 *     ├── 应用修复 + 重新构建 + 重启服务
 *     ├── 修复后测试 (不通过则继续修复)
 *     ├── 写 5 个标准文档 (01-05)
 *     └── 退出
 */

import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import simpleGit from 'simple-git';
import { getDatabase } from '../worker/db';
import { createLogger } from '../utils/logger';
import type { FixerConfig } from './designFixer';

const logger = createLogger('agent-fixer');

const ORCHESTRATOR_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes for orchestrator (create dirs)
const WORKER_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes per worker (fix one issue)

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
      const fixerCfg = data.ai?.fixer;
      const globalCfg = data.ai?.aiProvider || data.analysis?.aiProvider || data.server?.aiProvider;
      return {
        model: fixerCfg?.model || globalCfg?.model || 'claude-sonnet-4-6',
        apiKey: fixerCfg?.apiKey || globalCfg?.apiKey,
        baseUrl: fixerCfg?.baseUrl || globalCfg?.baseUrl,
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

/**
 * Create a slug from issue title for directory naming.
 */
function slugify(title: string): string {
  const stopWords = new Set(['的', '了', '在', '是', '和', '与', '或', '及', 'the', 'a', 'an', 'is', 'are', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of']);
  const words = title
    .replace(/[^\w\u4e00-\u9fff\s-]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 0 && !stopWords.has(w))
    .slice(0, 4);
  return words.join('-') || 'issue';
}

// ─── Level 1: Orchestrator Prompt ────────────────────────────────────────────

function buildOrchestratorPrompt(
  projectPath: string,
  reviews: Array<{
    id: number;
    title: string;
    severity: string;
    file_path: string | null;
    line: number | null;
    category: string | null;
    description: string | null;
    suggestion: string | null;
  }>
): string {
  const reviewList = reviews.map((r, i) =>
    `${i + 1}. [ID:${r.id}] ${r.title} (${r.severity}) — ${r.file_path || '无文件'}${r.line ? `:${r.line}` : ''} [${r.category || 'unknown'}]\n   描述: ${r.description || r.title}\n   建议: ${r.suggestion || '无'}`
  ).join('\n\n');

  return `你是一个代码修复协调 Agent。你的职责是：读取问题列表 → 创建修复任务目录。

## 你不是修复者，你是协调者

不要自己修复代码。你的工作是：
1. 读取以下待修复问题列表
2. 为每个问题创建一个修复任务目录

## 项目路径

${projectPath}

## 待修复问题列表

${reviewList}

## 操作步骤

1. 为每个问题创建目录:
   目录名: {问题关键词}-fix_${getToday()}/
   （英文小写，单词间用连字符，从标题提取 2-4 个核心词）

2. 在每个目录中创建 task.md:

\`\`\`markdown
# {问题标题}

- **Review ID**: {id}
- **严重程度**: {severity}
- **文件**: {file_path}
- **行号**: {line}
- **分类**: {category}

## 问题描述
{description}

## 修复建议
{suggestion}
\`\`\`

3. 在每个目录中创建 CLAUDE.md（工作指南）:

\`\`\`markdown
# 问题修复工作指南

## 项目信息
- **项目路径**: ${projectPath}
- **修复目录**: 当前目录
- **服务地址**: http://127.0.0.1:38888

## 你的工作流（严格按顺序执行）

### 第 1 步：阅读任务描述
读取当前目录的 \`task.md\`，了解要修复的问题。

### 第 2 步：深度分析问题
1. 使用 Read 阅读 task.md 中指定的问题文件（使用绝对路径）
2. 使用 Grep 搜索相关的函数调用、引用、测试
3. 使用 Read 阅读相关文件，理解上下文
4. 确认问题的存在和影响范围
5. 判断问题是前端（Vue/TS）还是后端（Node.js/API）

### 第 3 步：修复前测试（验证 Bug 存在）

**如果是前端问题（.vue/.ts 文件在 web/src/ 下）：**
1. 确保服务正在运行（http://127.0.0.1:38888）
2. 使用 Bash 运行 Playwright 测试脚本：
   - 打开相关页面
   - 模拟用户操作（点击、输入、选择）
   - 记录实际行为（与预期不符）
   - 截图保存为 \`before-fix.png\`
3. 将测试脚本保存为 \`test-before.js\`

**如果是后端问题（.ts 文件在 src/ 下）：**
1. 使用 Bash 运行 curl 测试：
   - 调用相关 API 端点
   - 记录实际响应（与预期不符）
   - 保存测试脚本为 \`test-before.sh\`

### 第 4 步：应用修复
1. 根据 task.md 中的修复建议，修改代码
2. 确保修复不会引入新问题
3. 保持代码风格一致
4. 如果是前端改动，重新构建：\`cd ${projectPath}/web && npm run build\`
5. 如果是后端改动，重新构建：\`cd ${projectPath} && npm run build\`
6. 重启服务：\`cd ${projectPath} && node dev-scripts/daemon.js restart\`

### 第 5 步：修复后测试（验证修复有效）

**如果是前端问题：**
1. 使用 Bash 运行 Playwright 测试脚本：
   - 打开相同页面
   - 执行相同操作
   - 验证预期行为（应该与修复前不同）
   - 截图保存为 \`after-fix.png\`
2. 将测试脚本保存为 \`test-after.js\`
3. 如果测试不通过，回到第 4 步继续修复，直到通过

**如果是后端问题：**
1. 使用 Bash 运行相同的 curl 测试
2. 验证响应符合预期
3. 如果测试不通过，回到第 4 步继续修复，直到通过

### 第 6 步：写入修复文档（5 个文件）

在当前目录写入以下文件，遵循 BUG-FIX-TEMPLATE 格式：

#### 01-ui-analysis.md（UI 控件分析）
- 组件结构图
- 控件清单表格
- 数据流分析
- 交互流程

#### 02-code-review.md（代码审查）
- 关键代码段
- 审查检查清单
- 发现的问题

#### 03-bug-discovery.md（问题发现）
- 发现时间和方式
- 问题描述
- 排查步骤（含代码证据）
- 根本原因
- 影响范围

#### 04-fix-implementation.md（修复实现）
- 修复方案
- 修改前代码 vs 修改后代码
- 文件变更清单

#### 05-ui-testing.md（测试验证）
- 测试环境
- 修复前测试结果（含截图引用 \`before-fix.png\`）
- 修复后测试结果（含截图引用 \`after-fix.png\`）
- 测试结果对比表
- 测试结论

### 第 7 步：退出
修复完成后退出，不要做其他事情。

## 重要规则
- 只修复 task.md 中描述的问题，不要做其他改动
- 修改代码时保持原有风格
- **必须运行真实测试**，不能只写静态文档声称修复
- **前端问题必须用 Playwright 截图**，后端问题必须用 curl 验证
- **测试不通过必须继续修复**，直到真正解决
- 如果问题无法修复（如文件不存在），在 03-bug-discovery.md 中说明原因
- 截图文件（*.png）也要保存在当前目录
\`\`\`

4. 完成后，将汇总写入 fixtasks/findings.json:
\`\`\`json
{
  "date": "${getToday()}",
  "findings": [
    {
      "id": {review_id},
      "title": "...",
      "severity": "critical|warning|info",
      "file": "src/xxx.ts",
      "line": 42,
      "category": "...",
      "dirName": "xxx-fix_${getToday()}",
      "status": "pending"
    }
  ]
}
\`\`\`

## 规则
- 使用中文
- 只创建你收到的问题目录，不要遗漏
- 每个问题目录必须同时创建 task.md 和 CLAUDE.md 两个文件
- dirName 必须与实际创建的目录名一致`;
}

// ─── Level 2: Worker Prompt ──────────────────────────────────────────────────

function buildWorkerPrompt(): string {
  return `请阅读当前目录的 CLAUDE.md 和 task.md，严格按照工作指南修复问题。

重要提醒：
1. 必须先运行修复前测试（Playwright 或 curl），截图保存
2. 应用修复后必须重新构建和重启服务
3. 必须运行修复后测试，验证问题已解决
4. 测试不通过必须继续修复，直到通过
5. 生成 5 个标准文档文件（01-05）
6. 截图文件（*.png）保存在当前目录`;
}

// ─── AgentFixer Class ────────────────────────────────────────────────────────

export class AgentFixer {
  private fixIntervalMs: number;
  private fixTimer: ReturnType<typeof setInterval> | null = null;
  private isFixing = false;
  private enabled = false;
  private currentProcess: ChildProcess | null = null;

  constructor(options?: { fixIntervalMs?: number }) {
    this.fixIntervalMs = options?.fixIntervalMs ?? 30 * 60 * 1000; // 30 minutes default
  }

  getFixerConfig(): FixerConfig {
    return {
      enabled: this.enabled,
      intervalMs: this.fixIntervalMs,
      isFixing: this.isFixing,
    };
  }

  updateFixerConfig(config: { enabled?: boolean; intervalMs?: number }): void {
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    }
    if (config.intervalMs !== undefined && config.intervalMs >= 60000) {
      this.fixIntervalMs = config.intervalMs;
    }
    this.stopFixer();
    if (this.enabled) {
      this.startFixer();
    }
    logger.info(`[AgentFixer] Config updated: enabled=${this.enabled}, interval=${this.fixIntervalMs}ms`);
  }

  startFixer(): void {
    if (this.fixTimer) return;
    if (!this.enabled) {
      logger.info('[AgentFixer] Fixer disabled, not starting');
      return;
    }
    logger.info(`[AgentFixer] Starting background fixer (interval: ${this.fixIntervalMs}ms)`);
    this.fixTimer = setInterval(() => this.fixAllProjects(), this.fixIntervalMs);
  }

  stopFixer(): void {
    if (this.fixTimer) {
      clearInterval(this.fixTimer);
      this.fixTimer = null;
      logger.info('[AgentFixer] Background fixer stopped');
    }
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
  }

  async fixAllProjects(): Promise<void> {
    if (this.isFixing) {
      logger.info('[AgentFixer] Fix already in progress, skipping');
      return;
    }
    this.isFixing = true;
    try {
      const db = await getDatabase();
      const projects = db.getProjects();
      for (const project of projects) {
        try {
          await this.fixProject(project.id, project.path, project.name);
        } catch (error: any) {
          logger.error(`[AgentFixer] Error fixing project ${project.name}: ${error.message}`);
        }
      }
    } finally {
      this.isFixing = false;
    }
  }

  async fixProject(projectId: string, projectPath: string, projectName: string): Promise<number> {
    logger.info(`[AgentFixer] Fixing project "${projectName}" at ${projectPath}`);

    const fixtasksBase = path.join(projectPath, '.claude-devsprite', 'fixtasks');
    try {
      fs.mkdirSync(fixtasksBase, { recursive: true });
    } catch (error: any) {
      logger.error(`[AgentFixer] Failed to create fixtasks directory: ${error.message}`);
      return 0;
    }

    this.isFixing = true;

    try {
      // ─── Step 1: Read pending reviews (agent-check source) ───
      const db = await getDatabase();
      const allPending = db.getPendingReviews(projectId);
      const pendingReviews = allPending
        .filter(r => r.source === 'agent-check')
        .sort((a, b) => {
          const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
          return (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
        });

      if (pendingReviews.length === 0) {
        logger.info(`[AgentFixer] No pending agent-check reviews for "${projectName}"`);
        return 0;
      }

      logger.info(`[AgentFixer] Found ${pendingReviews.length} pending agent-check reviews for "${projectName}"`);

      // ─── Step 2: Orchestrator — create fix task directories ───
      logger.info(`[AgentFixer] Phase 1: Orchestrator creating fix tasks for "${projectName}"`);
      const orchestratorResult = await this.spawnOrchestrator(
        projectPath, projectName, fixtasksBase, pendingReviews
      );

      if (orchestratorResult.killed) {
        logger.warn(`[AgentFixer] Orchestrator timed out for "${projectName}" — proceeding with any created directories`);
      }

      // ─── Step 3: Scan fixtasks/ for newly created fix directories ───
      const fixDirs = this.findFixDirs(fixtasksBase);
      if (fixDirs.length === 0) {
        logger.info(`[AgentFixer] No fix directories created for "${projectName}"`);
        return 0;
      }

      logger.info(`[AgentFixer] Found ${fixDirs.length} fix directories for "${projectName}"`);

      // ─── Step 4: Read findings.json to map dirs to review IDs ───
      const findingsMap = this.readFindingsMap(fixtasksBase);

      // ─── Step 5: Serial Workers — Orchestrator manages Worker lifecycle ───
      logger.info(`[AgentFixer] Phase 2: Running ${fixDirs.length} serial worker(s) for "${projectName}"`);
      await this.runFixWorkers(
        fixDirs, projectId, projectPath, projectName, fixtasksBase, findingsMap
      );

      logger.info(`[AgentFixer] Project "${projectName}": ${fixDirs.length} fixes processed`);
      return fixDirs.length;
    } finally {
      this.isFixing = false;
    }
  }

  // ─── Serial Fix Workers (Orchestrator 管理 Worker 生命周期) ────────────────

  /**
   * Orchestrator 串行管理 Worker:
   *   启动 Worker → 等待完成/超时 → 关闭 Worker → 下一个
   */
  private async runFixWorkers(
    fixDirs: string[],
    projectId: string,
    projectPath: string,
    projectName: string,
    fixtasksBase: string,
    findingsMap: Map<string, number> // dirName → reviewId
  ): Promise<void> {
    for (let i = 0; i < fixDirs.length; i++) {
      const fixDir = fixDirs[i];
      const fixPath = path.join(fixtasksBase, fixDir);
      const reviewId = findingsMap.get(fixDir);

      logger.info(`[AgentFixer] Fixing [${i + 1}/${fixDirs.length}]: ${fixDir}`);

      // 1. 启动 Worker (短生命周期, 在 fix 目录下运行)
      const workerProcess = this.spawnFixWorker(projectPath, fixPath);
      this.currentProcess = workerProcess;

      // 2. 等待 Worker 完成或超时
      const { timedOut } = await this.waitForProcess(workerProcess, WORKER_TIMEOUT_MS);
      this.currentProcess = null;

      // 3. 关闭 Worker (如果超时, 强制 kill)
      if (timedOut) {
        logger.warn(`[AgentFixer] Worker timeout for "${fixDir}" — killed by Orchestrator`);
      }

      // 4. Git commit + push (代码 + fixtasks 文档)
      await this.commitAndPush(projectPath, projectName, fixPath);

      // 5. 更新 review 状态为 'fixed'
      if (reviewId) {
        const db = await getDatabase();
        db.updateReview(reviewId, {
          status: 'fixed',
          resolved_at: new Date().toISOString(),
        });
        logger.info(`[AgentFixer] Review ${reviewId} marked as fixed`);
      }

      logger.info(`[AgentFixer] Completed fix: ${fixDir} — Orchestrator moving to next Worker`);
    }
  }

  // ─── Orchestrator (Level 1) ────────────────────────────────────────────────

  private spawnOrchestrator(
    projectPath: string,
    projectName: string,
    cwdDir: string,
    reviews: Array<{
      id: number;
      title: string;
      severity: string;
      file_path: string | null;
      line: number | null;
      category: string | null;
      description: string | null;
      suggestion: string | null;
    }>
  ): Promise<{ exitCode: number | null; killed: boolean; stderr: string }> {
    const agentConfig = loadAgentConfig();
    const claudePath = resolveClaudeCLI();
    const env = buildCleanEnv(agentConfig);
    const prompt = buildOrchestratorPrompt(projectPath, reviews);

    const args = [
      '--dangerously-skip-permissions',
      '--model', agentConfig.model || 'claude-sonnet-4-6',
    ];

    logger.info(`[AgentFixer] Orchestrator: ${claudePath} in ${cwdDir}`);

    return new Promise((resolve) => {
      const child = spawn(claudePath, args, {
        cwd: cwdDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: process.platform === 'win32',
      });

      let stderr = '';
      let killed = false;

      child.stdout?.on('data', () => {});
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      const timeout = setTimeout(() => {
        killed = true;
        logger.warn(`[AgentFixer] Orchestrator timeout for "${projectName}"`);
        child.kill('SIGTERM');
      }, ORCHESTRATOR_TIMEOUT_MS);

      child.on('error', (error) => {
        clearTimeout(timeout);
        logger.error(`[AgentFixer] Orchestrator failed for "${projectName}": ${error.message}`);
        resolve({ exitCode: -1, killed: false, stderr: error.message });
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (killed) {
          logger.warn(`[AgentFixer] Orchestrator killed for "${projectName}"`);
        } else if (code !== 0) {
          logger.error(`[AgentFixer] Orchestrator exited ${code} for "${projectName}"`);
          if (stderr) logger.error(`[AgentFixer] stderr: ${stderr.substring(0, 500)}`);
        }
        resolve({ exitCode: code, killed, stderr });
      });

      child.stdin?.write(prompt);
      child.stdin?.end();
    });
  }

  // ─── Worker (Level 2, 短生命周期) ──────────────────────────────────────────

  /**
   * 启动 Worker (短生命周期, 一次修复一个问题)
   * Orchestrator 启动它, 等待完成/超时, 然后关闭
   */
  private spawnFixWorker(
    projectPath: string,
    fixPath: string
  ): ChildProcess {
    const agentConfig = loadAgentConfig();
    const claudePath = resolveClaudeCLI();
    const env = buildCleanEnv(agentConfig);
    const prompt = buildWorkerPrompt();

    const args = [
      '--dangerously-skip-permissions',
      '--model', agentConfig.model || 'claude-sonnet-4-6',
    ];

    const fixDirName = path.basename(fixPath);
    logger.info(`[AgentFixer] Worker: ${claudePath} in ${fixPath}`);

    const child = spawn(claudePath, args, {
      cwd: fixPath,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: process.platform === 'win32',
    });

    child.stdout?.on('data', () => {});
    child.stderr?.on('data', () => {});

    child.on('error', (error) => {
      logger.error(`[AgentFixer] Worker failed in "${fixDirName}": ${error.message}`);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        logger.error(`[AgentFixer] Worker exited ${code} in "${fixDirName}"`);
      } else {
        logger.info(`[AgentFixer] Worker completed: "${fixDirName}"`);
      }
    });

    child.stdin?.write(prompt);
    child.stdin?.end();

    return child;
  }

  /**
   * 等待 Worker 完成或超时
   * Orchestrator 调用此方法监控 Worker 生命周期
   */
  private waitForProcess(child: ChildProcess, timeoutMs: number): Promise<{ timedOut: boolean }> {
    return new Promise((resolve) => {
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        logger.warn(`[AgentFixer] Worker timeout — Orchestrator killing process`);
        child.kill('SIGTERM');
      }, timeoutMs);

      child.on('close', () => {
        clearTimeout(timeout);
        resolve({ timedOut });
      });

      child.on('error', () => {
        clearTimeout(timeout);
        resolve({ timedOut });
      });
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Find fix directories in fixtasks/ (dirs containing task.md)
   */
  private findFixDirs(fixtasksBase: string): string[] {
    try {
      const entries = fs.readdirSync(fixtasksBase, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory() && fs.existsSync(path.join(fixtasksBase, e.name, 'task.md')))
        .map(e => e.name)
        .sort();
    } catch {
      return [];
    }
  }

  /**
   * Read findings.json and build dirName → reviewId map
   */
  private readFindingsMap(fixtasksBase: string): Map<string, number> {
    const map = new Map<string, number>();
    const findingsPath = path.join(fixtasksBase, 'findings.json');
    try {
      if (!fs.existsSync(findingsPath)) return map;
      const raw = fs.readFileSync(findingsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed.findings) ? parsed.findings : [];
      for (const f of items) {
        if (f.dirName && f.id) {
          map.set(f.dirName, f.id);
        }
      }
    } catch {
      // ignore
    }
    return map;
  }

  /**
   * Git commit + push for a specific fix directory
   */
  private async commitAndPush(
    projectPath: string,
    projectName: string,
    fixDir: string
  ): Promise<void> {
    try {
      const git = simpleGit(projectPath);
      const status = await git.status();

      // Check if there are any changes
      if (!status.staged.length && !status.modified.length && !status.not_added.length) {
        logger.info(`[AgentFixer] No changes to commit for ${path.basename(fixDir)}`);
        return;
      }

      // Stage code changes (modified files)
      const codeExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.css', '.scss']);
      for (const file of status.modified) {
        const ext = path.extname(file);
        if (codeExts.has(ext)) {
          await git.add(file);
        }
      }

      // Stage new files: code + fixtask documentation
      const stageExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.css', '.scss', '.md', '.png', '.sh']);
      for (const file of status.not_added) {
        const ext = path.extname(file);
        if (stageExts.has(ext)) {
          await git.add(file);
        }
      }

      // Also stage the fixtask directory (documentation, screenshots, test scripts)
      const fixDirRel = path.relative(projectPath, fixDir);
      try {
        await git.add(`${fixDirRel}/`);
      } catch {
        // Directory may not exist or be empty — non-fatal
      }

      // Check if anything was staged after our selective add
      const newStatus = await git.status();
      if (!newStatus.staged.length) {
        logger.info(`[AgentFixer] No code changes staged for ${path.basename(fixDir)}`);
        return;
      }

      await git.commit(`fix(auto): ${path.basename(fixDir)}`);

      const branch = status.current || 'main';
      const remotes = await git.getRemotes();
      if (remotes.length) {
        try {
          await git.push('origin', branch);
          logger.info(`[AgentFixer] Pushed fix to origin/${branch}`);
        } catch (pushErr: any) {
          logger.warn(`[AgentFixer] Push failed (commit saved locally): ${pushErr.message}`);
        }
      }
    } catch (error: any) {
      logger.error(`[AgentFixer] Git commit failed: ${error.message}`);
    }
  }
}

/**
 * Shared singleton fixer instance.
 */
let _sharedFixer: AgentFixer | null = null;

export function getSharedFixer(options?: { fixIntervalMs?: number }): AgentFixer {
  if (!_sharedFixer) {
    _sharedFixer = new AgentFixer(options);
  }
  return _sharedFixer;
}

export function resetSharedFixer(): void {
  if (_sharedFixer) {
    _sharedFixer.stopFixer();
    _sharedFixer = null;
  }
}
