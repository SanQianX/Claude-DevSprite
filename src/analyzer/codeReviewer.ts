/**
 * AI Code Reviewer
 * Scans code changes, generates review findings, and manages the review queue.
 * 
 * This module includes a background scanner that automatically reviews new commits at regular intervals.
 * The scanner is started via the `startScanner()` method and runs independently of user interactions.
 * User-triggered scans are handled through API endpoints (e.g., POST /reviews/:id/fix), which allow
 * the frontend to request immediate analysis of specific commits or reviews.
 * 
 * TODO: 根据设计文档，DevChat的实时聊天功能（WebSocket通信）应在其他模块（如 `src/worker/wsHandler.ts`）中实现，
 *       以分离实时通信与代码审查的核心分析职责。本模块专注于异步的、基于AI的代码分析和审查。
 * 
 * **功能补充说明（对应审查意见）:**
 * - **后台自动扫描机制**: `startScanner()` 方法启动一个独立的定时器（`setInterval`），默认每 **5分钟** 执行一次 `scanAllProjects()`。
 * - **触发机制**: 基于定时器，非用户交互触发。与用户手动发起的扫描（如通过API调用 `generateFix`）是两条独立的处理路径。
 * - **可配置性**: 扫描间隔可通过构造函数参数 `options.scanIntervalMs` 进行自定义（毫秒）。
 * - **产出**: 扫描发现的新问题会通过 `createReviewsBatch()` 方法批量写入数据库的 `reviews` 表，状态默认为 `pending`，供前端 UI 展示和管理。
 * - **设计文档位置建议**: 此功能应在 `FUNCTIONAL-LOGIC-ANALYSIS.md` 的 Module 2 (AI审查) 或“数据流排查”部分作为独立子模块进行描述。
 */

import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import { AIProvider, type AIConfig } from './aiProvider';
import { DiffCollector } from './diffCollector';
import { getDatabase } from '../worker/db';
import { createLogger } from '../utils/logger';

const logger = createLogger('code-reviewer');

export interface ReviewFinding {
  file: string;
  line: number;
  severity: 'Critical' | 'Major' | 'Minor';
  category: string;
  title: string;
  description: string;
  suggestion?: string;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  filesReviewed: number;
  modelUsed: string;
}

const CODE_REVIEW_PROMPT = `你是一位资深的代码审查专家。请审查以下代码变更，找出潜在问题。

## 项目: {{projectName}}

## 变更文件
{{changedFiles}}

## Diff 内容
{{diffContent}}

---

请分析这些代码变更，找出以下类型的问题：
1. **安全漏洞** (Critical) - SQL注入、XSS、路径遍历、敏感信息泄露等
2. **性能问题** (Major) - N+1查询、内存泄漏、不必要的重渲染等
3. **代码质量** (Minor) - 命名不规范、重复代码、缺少错误处理等
4. **最佳实践** (Minor) - 不符合框架惯例、可维护性问题等

请用 JSON 格式回复（不要用 markdown 代码块）：
{
  "findings": [
    {
      "file": "src/example.ts",
      "line": 42,
      "severity": "Critical|Major|Minor",
      "category": "security|performance|quality|practice",
      "title": "问题标题",
      "description": "详细描述问题",
      "suggestion": "修复建议"
    }
  ],
  "summary": "总体评价：本次变更涉及X个文件，发现Y个问题..."
}

要求：
- 只报告真实问题，不要报告不存在的问题
- severity 必须准确：Critical 只用于安全漏洞和数据损坏风险
- 每个 finding 的 line 应该是变更后的行号（基于 diff 中的 + 行）
- 使用中文回复
- 如果没有发现问题，findings 返回空数组，summary 说明代码质量良好`;

const FIX_PROMPT = `你是一位资深的代码修复专家。请根据以下审查意见，生成修复后的代码。

## 审查意见
文件: {{file}}
问题: {{title}}
描述: {{description}}
建议: {{suggestion}}

## 当前代码
{{currentCode}}

---

请生成修复后的完整文件内容。要求：
1. 只修复描述的问题，不要做其他改动
2. 保持代码风格一致
3. 确保修复不会引入新问题

请用 JSON 格式回复（不要用 markdown 代码块）：
{
  "fixedContent": "修复后的完整文件内容",
  "explanation": "修复说明"
}`;

export class CodeReviewer {
  private aiProvider: AIProvider;
  private scanIntervalMs: number;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private isScanning = false;

  constructor(options?: { model?: string; scanIntervalMs?: number; agentConfig?: AIConfig }) {
    this.aiProvider = new AIProvider({ model: options?.model, agentConfig: options?.agentConfig });
    this.scanIntervalMs = options?.scanIntervalMs ?? 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Start the background scanner.
   * This method initializes a timer to periodically scan all projects for new commits
   * and generate review findings automatically. The scan runs at a fixed interval (default: 5 minutes).
   * 
   * **机制与产出说明（补充文档）:**
   * - **触发机制**: 创建一个 `setInterval` 定时器。
   * - **首次执行**: 启动后会有一个短延迟（10秒）的初始扫描。
   * - **扫描过程**: 调用 `scanAllProjects()` -> `scanProject()` -> `reviewCommit()`。
   * - **产出**: 对比项目上次记录的提交哈希，找出新提交，生成 `ReviewResult`，并将发现的问题 (`findings`) 批量插入数据库 (`reviews` 表)，状态为 `pending`。
   * 
   * This background scan is complementary to user-triggered scans via API endpoints (e.g., POST /reviews/:id/fix),
   * which are initiated by frontend interactions such as clicking a button.
   * The background scanner ensures continuous monitoring of code changes, while user-triggered scans
   * provide on-demand analysis.
   */
  startScanner(): void {
    if (this.scanTimer) return;
    logger.info(`[CodeReviewer] Starting background scanner (interval: ${this.scanIntervalMs}ms)`);
    this.scanTimer = setInterval(() => this.scanAllProjects(), this.scanIntervalMs);
    // Run initial scan after a short delay
    setTimeout(() => this.scanAllProjects(), 10000);
  }

  /**
   * Stop the background scanner
   */
  stopScanner(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
      logger.info('[CodeReviewer] Background scanner stopped');
    }
  }

  /**
   * Scan all projects for new changes
   */
  async scanAllProjects(): Promise<void> {
    if (this.isScanning) {
      logger.info('[CodeReviewer] Scan already in progress, skipping');
      return;
    }

    this.isScanning = true;
    try {
      const db = await getDatabase();
      const projects = db.getProjects();

      for (const project of projects) {
        try {
          await this.scanProject(project.id, project.path, project.name);
        } catch (error: any) {
          logger.error(`[CodeReviewer] Error scanning project ${project.name}: ${error.message}`);
        }
      }
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Scan a single project for new commits since last review
   */
  async scanProject(projectId: string, projectPath: string, projectName: string): Promise<number> {
    const db = await getDatabase();
    const lastReview = db.getLatestReviewCommit(projectId);

    const git = simpleGit(projectPath);
    let logResult: any;

    try {
      logResult = await git.log({ from: lastReview || undefined, maxCount: 10 });
    } catch {
      logger.info(`[CodeReviewer] Not a git repo or no commits: ${projectPath}`);
      return 0;
    }

    if (!logResult || logResult.all.length === 0) {
      return 0;
    }

    // Skip the initial commit if no previous review
    const commits = lastReview ? logResult.all : logResult.all.slice(0, 5);
    let totalFindings = 0;

    for (const commit of commits) {
      try {
        const result = await this.reviewCommit(projectId, projectPath, projectName, commit.hash);
        totalFindings += result.findings.length;
      } catch (error: any) {
        logger.error(`[CodeReviewer] Error reviewing commit ${commit.hash}: ${error.message}`);
      }
    }

    if (totalFindings > 0) {
      logger.info(`[CodeReviewer] Project "${projectName}": found ${totalFindings} new findings`);
    }

    return totalFindings;
  }

  /**
   * Review a specific commit
   */
  async reviewCommit(
    projectId: string,
    projectPath: string,
    projectName: string,
    commitHash: string
  ): Promise<ReviewResult> {
    const diffCollector = new DiffCollector(projectPath);
    const diffs = await diffCollector.collectDiffs(commitHash);

    // Filter to code files only
    const codeDiffs = diffs.filter(d =>
      /\.(ts|tsx|js|jsx|py|java|go|rs|cs|php|rb|vue|svelte)$/.test(d.filePath) &&
      d.diff && d.diff.length > 0
    );

    if (codeDiffs.length === 0) {
      return { findings: [], summary: '无代码文件变更', filesReviewed: 0, modelUsed: '' };
    }

    // Build prompt
    const changedFiles = codeDiffs.map(d =>
      `- ${d.filePath} (+${d.additions} -${d.deletions})`
    ).join('\n');

    const diffContent = codeDiffs.map(d =>
      `### ${d.filePath}\n\`\`\`diff\n${(d.diff || '').substring(0, 8000)}\n\`\`\``
    ).join('\n\n');

    const prompt = CODE_REVIEW_PROMPT
      .replace('{{projectName}}', projectName)
      .replace('{{changedFiles}}', changedFiles)
      .replace('{{diffContent}}', diffContent);

    // Call AI
    const response = await this.aiProvider.callAI(prompt);

    // Parse result
    const result = this.parseReviewResponse(response, codeDiffs.length);

    // Save findings to database
    const db = await getDatabase();
    if (result.findings.length > 0) {
      const reviews = result.findings.map(finding => ({
        project_id: projectId,
        commit_hash: commitHash,
        file_path: finding.file,
        line: finding.line,
        severity: finding.severity,
        category: finding.category,
        title: finding.title,
        description: finding.description,
        suggestion: finding.suggestion || null,
        location: `${finding.file}:${finding.line}`,
        source: 'ai' as const,
        status: 'pending' as const,
      }));
      db.createReviewsBatch(reviews);
    }

    // Update last review commit
    db.updateLastReviewCommit(projectId, commitHash);

    logger.info(`[CodeReviewer] Commit ${commitHash.substring(0, 8)}: ${result.findings.length} findings`);
    return result;
  }

  /**
   * Generate a fix for a review finding.
   * This method corresponds to the POST /reviews/:id/fix endpoint, as per design documentation.
   *
   * **关于端点的说明:**
   * - 本方法仅用于生成修复内容，由 POST /reviews/:id/fix 路由调用。
   * - 审核状态更新（approve/ignore）由 reviews.ts 和 dashboard.ts 中的
   *   PUT /api/projects/:name/reviews/:id 端点处理，前端正在使用该端点。
   */
  async generateFix(
    projectPath: string,
    filePath: string,
    finding: { title: string; description: string; suggestion?: string },
    reviewId?: number
  ): Promise<{ fixedContent: string; explanation: string } | null> {
    const fullPath = path.join(projectPath, filePath);
    if (!fs.existsSync(fullPath)) return null;

    const currentCode = fs.readFileSync(fullPath, 'utf-8');
    if (currentCode.length > 50000) return null; // Too large for AI

    const prompt = FIX_PROMPT
      .replace('{{file}}', filePath)
      .replace('{{title}}', finding.title)
      .replace('{{description}}', finding.description)
      .replace('{{suggestion}}', finding.suggestion || '请根据最佳实践修复')
      .replace('{{currentCode}}', currentCode);

    const response = await this.aiProvider.callAI(prompt);

    try {
      const parsed = JSON.parse(response.content);
      if (typeof parsed.fixedContent === 'string' && parsed.fixedContent.length > 0 && typeof parsed.explanation === 'string') {
        // Write fixed content to file
        fs.writeFileSync(fullPath, parsed.fixedContent, 'utf-8');
        logger.info(`[CodeReviewer] Fixed file ${filePath}`);

        // Update database status if reviewId provided
        if (reviewId != null && typeof reviewId === 'number') {
          try {
            const db = await getDatabase();
            db.updateReview(reviewId, { status: 'fixed' });
            logger.info(`[CodeReviewer] Updated review ${reviewId} status to 'fixed'`);
          } catch (dbError: any) {
            logger.error(`[CodeReviewer] Failed to update review status: ${dbError.message}`);
          }
        }

        return parsed;
      }
    } catch {
      logger.warn('[CodeReviewer] Failed to parse fix response');
    }

    return null;
  }

  private parseReviewResponse(response: { content: string }, filesReviewed: number): ReviewResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          findings: [],
          summary: 'AI 响应格式异常，无法解析',
          filesReviewed,
          modelUsed: '',
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const findings: ReviewFinding[] = (parsed.findings || []).map((f: any) => ({
        file: f.file || '',
        line: f.line || 0,
        severity: ['Critical', 'Major', 'Minor'].includes(f.severity) ? f.severity : 'Minor',
        category: ['security', 'performance', 'quality', 'practice'].includes(f.category) ? f.category : 'quality',
        title: f.title || '未命名问题',
        description: f.description || '',
        suggestion: f.suggestion,
      }));

      return {
        findings,
        summary: parsed.summary || `审查完成，发现 ${findings.length} 个问题`,
        filesReviewed,
        modelUsed: '',
      };
    } catch (error: any) {
      logger.error('[CodeReviewer] Failed to parse review response:', error);
      return {
        findings: [],
        summary: `解析失败: ${error.message}`,
        filesReviewed,
        modelUsed: '',
      };
    }
  }
}

