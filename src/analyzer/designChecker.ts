/**
 * Design Consistency Checker
 * Compares actual code against design docs and knowledge base to find mismatches
 */

import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import { AIProvider } from './aiProvider';
import { CodeReviewer } from './codeReviewer';
import { getDatabase } from '../worker/db';
import { createLogger } from '../utils/logger';
import { KnowledgeBaseManager } from '../knowledge';

const logger = createLogger('design-checker');

interface DesignFinding {
  file: string;
  line: number;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  suggestion?: string;
}

interface DesignCheckResult {
  findings: DesignFinding[];
  summary: string;
  filesReviewed: number;
  modelUsed: string;
}

const DESIGN_CHECK_PROMPT = `你是一个功能一致性检查专家。请比较"设计文档"和"实际代码"，找出不一致。

## 项目: {{projectName}}

## 设计文档
{{designDocs}}

## 知识库文档
{{kbDocs}}

## 实际代码
{{sourceFiles}}

请检查以下方面：
1. 设计中描述的功能是否在代码中实现
2. 代码逻辑是否与设计一致
3. API 路由路径是否与文档一致
4. 状态管理逻辑是否与文档描述一致
5. 组件间数据流是否正确
6. 是否存在死代码（设计中已删除但代码中仍存在）
7. 是否存在未记录功能（代码中存在但文档未描述）

请用 JSON 格式回复（不要用 markdown 代码块）：
{
  "findings": [
    {
      "file": "src/example.ts",
      "line": 0,
      "severity": "critical|warning|info",
      "category": "missing-impl|dead-code|logic-mismatch|api-mismatch|state-mismatch|unrecorded|dataflow",
      "title": "问题标题",
      "description": "详细描述不一致之处",
      "suggestion": "修复建议"
    }
  ],
  "summary": "总结：检查了X个文件，发现Y个不一致..."
}

【重要】file 字段要求：
- file 必须是上面"实际代码"部分中出现的一个源代码文件路径（如 src/analyzer/aiProvider.ts）
- file 必须指向需要修改的源代码文件，不能是"设计文档"、"知识库"等文档名称
- 如果问题涉及多个文件，选择最相关的那个
- 如果问题纯属设计层面、没有对应的代码文件可修改，将 file 设为空字符串 ""

要求：
- 只报告真实的问题，不要报告不存在的问题
- severity 标准：critical=功能缺失或严重不一致，warning=部分不一致或潜在问题，info=轻微偏差
- category 必须是上面列出的类型之一
- 使用中文回复
- 如果设计文档或知识库为空，说明缺少文档，findings 返回空数组
- 如果没有发现问题，findings 返回空数组，summary 说明一致性良好`;

const CODE_EXTENSIONS = /\.(ts|tsx|js|jsx|vue|svelte|py|java|go|rs|cs)$/;
const MAX_SOURCE_FILES = 20;
const MAX_SOURCE_SIZE = 300 * 1024; // 300KB total

export interface ScannerConfig {
  enabled: boolean;
  intervalMs: number;
  isScanning: boolean;
}

export class DesignChecker {
  private aiProvider: AIProvider;
  private scanIntervalMs: number;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private isScanning = false;
  private enabled = true;

  constructor(options?: { model?: string; scanIntervalMs?: number }) {
    this.aiProvider = new AIProvider({ model: options?.model });
    this.scanIntervalMs = options?.scanIntervalMs ?? 10 * 60 * 1000; // 10 minutes default
  }

  getConfig(): ScannerConfig {
    return {
      enabled: this.enabled,
      intervalMs: this.scanIntervalMs,
      isScanning: this.isScanning,
    };
  }

  updateConfig(config: { enabled?: boolean; intervalMs?: number }): void {
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    }
    if (config.intervalMs !== undefined && config.intervalMs >= 60000) {
      this.scanIntervalMs = config.intervalMs;
    }
    // Restart scanner with new config
    this.stopScanner();
    if (this.enabled) {
      this.startScanner();
    }
    logger.info(`[DesignChecker] Config updated: enabled=${this.enabled}, interval=${this.scanIntervalMs}ms`);
  }

  startScanner(): void {
    if (this.scanTimer) return;
    if (!this.enabled) {
      logger.info('[DesignChecker] Scanner disabled, not starting');
      return;
    }
    logger.info(`[DesignChecker] Starting background scanner (interval: ${this.scanIntervalMs}ms)`);
    this.scanTimer = setInterval(() => this.scanAllProjects(), this.scanIntervalMs);
    // Run initial scan after 30 seconds (delayed to let DB and projects initialize)
    setTimeout(() => this.scanAllProjects(), 30000);
  }

  stopScanner(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
      logger.info('[DesignChecker] Background scanner stopped');
    }
  }

  async scanAllProjects(): Promise<void> {
    if (this.isScanning) {
      logger.info('[DesignChecker] Scan already in progress, skipping');
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
          logger.error(`[DesignChecker] Error scanning project ${project.name}: ${error.message}`);
        }
      }
    } finally {
      this.isScanning = false;
    }
  }

  async scanProject(projectId: string, projectPath: string, projectName: string): Promise<number> {
    logger.info(`[DesignChecker] Scanning project "${projectName}"`);

    // 1. Collect design documents from tasks/ directory
    const designDocs = this.collectDesignDocs(projectPath);

    // 2. Collect knowledge base documents
    const kbDocs = await this.collectKnowledgeDocs(projectPath, projectId);

    // 3. Collect key source files
    const sourceFiles = this.collectKeySourceFiles(projectPath);

    if (designDocs.length === 0 && kbDocs.length === 0) {
      logger.info(`[DesignChecker] No design docs or knowledge base found for "${projectName}", skipping`);
      return 0;
    }

    if (sourceFiles.length === 0) {
      logger.info(`[DesignChecker] No source files found for "${projectName}", skipping`);
      return 0;
    }

    // 4. Build prompt
    const designDocsText = designDocs.length > 0
      ? designDocs.map(d => `### ${d.name}\n${d.content.substring(0, 15000)}`).join('\n\n')
      : '（无设计文档）';

    const kbDocsText = kbDocs.length > 0
      ? kbDocs.map(d => `### ${d.title} (${d.category})\n${d.content.substring(0, 10000)}`).join('\n\n')
      : '（无知识库文档）';

    const sourceFilesText = sourceFiles.map(f =>
      `### ${f.relativePath}\n\`\`\`${f.lang}\n${f.content.substring(0, 5000)}\n\`\`\``
    ).join('\n\n');

    const prompt = DESIGN_CHECK_PROMPT
      .replace('{{projectName}}', projectName)
      .replace('{{designDocs}}', designDocsText)
      .replace('{{kbDocs}}', kbDocsText)
      .replace('{{sourceFiles}}', sourceFilesText);

    // 5. Call AI
    const response = await this.aiProvider.callAI(prompt);

    // 6. Parse response
    const result = this.parseResponse(response, sourceFiles.length);

    // 6.5 Validate file paths - ensure they point to real code files
    const validFilePaths = new Set(sourceFiles.map(f => f.relativePath));
    for (const finding of result.findings) {
      if (finding.file && !validFilePaths.has(finding.file)) {
        // Try to find a matching file from the source files list
        const inferred = this.inferFilePath(finding.file, finding.title, finding.description, sourceFiles);
        if (inferred) {
          logger.info(`[DesignChecker] Inferred file path: "${finding.file}" → "${inferred}"`);
          finding.file = inferred;
        } else {
          logger.warn(`[DesignChecker] Invalid file path "${finding.file}" for finding "${finding.title}", clearing`);
          finding.file = '';
        }
      }
    }

    // 7. Save findings to database
    const db = await getDatabase();
    if (result.findings.length > 0) {
      const reviews = result.findings.map(finding => ({
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
        source: 'design-check' as const,
        status: 'pending' as const,
      }));
      db.createReviewsBatch(reviews);

      // 7.5 Create tasks for each review to sync with task management module
      const pendingReviews = db.getPendingReviews(projectId)
        .filter((r: any) => r.source === 'design-check');

      for (const review of pendingReviews) {
        try {
          const task = {
            project_id: projectId,
            title: `设计检查任务: ${review.title}`,
            description: review.description || review.title,
            status: 'open',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            review_id: review.id, // Link task to review for state synchronization
          };
          db.createTask(task);
        } catch (error: any) {
          logger.warn(`[DesignChecker] Failed to create task for review ${review.id}: ${error.message}`);
        }
      }

      // 8. Auto-fix newly created reviews
      const newReviewIds = pendingReviews.map((r: any) => r.id)
        .filter((id: number) => {
          // Only fix reviews that were just created (in this batch)
          return result.findings.some((_, idx) => {
            const review = reviews[idx];
            return review && db.getReview(id)?.title === review.title;
          });
        });

      if (newReviewIds.length > 0) {
        logger.info(`[DesignChecker] Auto-fixing ${newReviewIds.length} reviews for "${projectName}"`);
        const fixResult = await this.autoFixReviews(projectPath, projectId, newReviewIds);
        logger.info(`[DesignChecker] Auto-fix result: ${fixResult.fixed} fixed, ${fixResult.confirmed} confirmed, ${fixResult.failed} failed`);

        // 9. Git commit and push if any files were fixed
        if (fixResult.fixed > 0) {
          await this.commitAndPush(projectPath, projectName, fixResult.fixed);
        }
      }
    }

    logger.info(`[DesignChecker] Project "${projectName}": ${result.findings.length} findings from ${sourceFiles.length} files`);
    return result.findings.length;
  }

  private collectDesignDocs(projectPath: string): Array<{ name: string; content: string }> {
    const tasksDir = path.join(projectPath, 'tasks');
    const docs: Array<{ name: string; content: string }> = [];

    const designFiles = [
      'FUNCTIONAL-LOGIC-ANALYSIS.md',
      'COMPONENT-INVENTORY.md',
      'BUG-HUNTING-PLAN.md',
    ];

    for (const fileName of designFiles) {
      const filePath = path.join(tasksDir, fileName);
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.trim().length > 0) {
            docs.push({ name: fileName, content });
          }
        }
      } catch (error: any) {
        logger.warn(`[DesignChecker] Failed to read ${fileName}: ${error.message}`);
      }
    }

    return docs;
  }

  private async collectKnowledgeDocs(
    projectPath: string,
    projectId: string
  ): Promise<Array<{ title: string; category: string; content: string }>> {
    try {
      const db = await getDatabase();
      const project = db.getProjectById(projectId);
      if (!project || !project.knowledge_path) return [];

      const kbManager = new KnowledgeBaseManager(project.knowledge_path);
      const documents = await kbManager.listDocuments();

      // Limit to most relevant docs, cap total content
      return documents.slice(0, 10).map(doc => ({
        title: doc.title,
        category: doc.category,
        content: doc.content,
      }));
    } catch (error: any) {
      logger.warn(`[DesignChecker] Failed to read knowledge base: ${error.message}`);
      return [];
    }
  }

  private collectKeySourceFiles(projectPath: string): Array<{ relativePath: string; content: string; lang: string }> {
    const files: Array<{ relativePath: string; content: string; lang: string }> = [];
    let totalSize = 0;

    const collectDir = (dir: string, depth: number = 0) => {
      if (depth > 5 || files.length >= MAX_SOURCE_FILES || totalSize >= MAX_SOURCE_SIZE) return;

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (files.length >= MAX_SOURCE_FILES || totalSize >= MAX_SOURCE_SIZE) break;

          const fullPath = path.join(dir, entry.name);

          // Skip hidden dirs, node_modules, dist, build
          if (entry.isDirectory()) {
            if (/^\./.test(entry.name) || /^(node_modules|dist|build|\.git|coverage)$/.test(entry.name)) continue;
            collectDir(fullPath, depth + 1);
          } else if (entry.isFile() && CODE_EXTENSIONS.test(entry.name)) {
            try {
              const stat = fs.statSync(fullPath);
              if (stat.size > 50000) continue; // Skip very large files

              const content = fs.readFileSync(fullPath, 'utf-8');
              const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, '/');
              totalSize += content.length;
              files.push({
                relativePath,
                content,
                lang: entry.name.split('.').pop() || 'text',
              });
            } catch {
              // Skip unreadable files
            }
          }
        }
      } catch {
        // Skip unreadable directories
      }
    };

    // Start from src/ directory
    const srcDir = path.join(projectPath, 'src');
    if (fs.existsSync(srcDir)) {
      collectDir(srcDir);
    }

    // If not enough files, also scan web/src/
    if (files.length < MAX_SOURCE_FILES) {
      const webSrcDir = path.join(projectPath, 'web', 'src');
      if (fs.existsSync(webSrcDir)) {
        collectDir(webSrcDir);
      }
    }

    return files;
  }

  private parseResponse(response: { content: string }, filesReviewed: number): DesignCheckResult {
    try {
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
      const validSeverities = ['critical', 'warning', 'info'];
      const validCategories = ['missing-impl', 'dead-code', 'logic-mismatch', 'api-mismatch', 'state-mismatch', 'unrecorded', 'dataflow'];

      const findings: DesignFinding[] = (parsed.findings || []).map((f: any) => ({
        file: f.file || '',
        line: f.line || 0,
        severity: validSeverities.includes(f.severity) ? f.severity : 'info',
        category: validCategories.includes(f.category) ? f.category : 'logic-mismatch',
        title: f.title || '未命名问题',
        description: f.description || '',
        suggestion: f.suggestion,
      }));

      return {
        findings,
        summary: parsed.summary || `检查完成，发现 ${findings.length} 个不一致`,
        filesReviewed,
        modelUsed: '',
      };
    } catch (error: any) {
      logger.error('[DesignChecker] Failed to parse AI response:', error);
      return {
        findings: [],
        summary: `解析失败: ${error.message}`,
        filesReviewed,
        modelUsed: '',
      };
    }
  }

  /**
   * Auto-fix reviews: valid file_path → AI fix, invalid → confirmed
   */
  private async autoFixReviews(
    projectPath: string,
    projectId: string,
    reviewIds: number[]
  ): Promise<{ fixed: number; confirmed: number; failed: number }> {
    const db = await getDatabase();
    const reviews = reviewIds
      .map(id => db.getReview(id))
      .filter((r: any): r is NonNullable<typeof r> => r != null && r.project_id === projectId);

    if (reviews.length === 0) return { fixed: 0, confirmed: 0, failed: 0 };

    const codeReviewer = new CodeReviewer();
    let fixed = 0;
    let confirmed = 0;
    let failed = 0;

    for (const review of reviews) {
      try {
        const isValidFilePath = review.file_path
          && /\.(ts|tsx|js|jsx|vue|svelte|py|java|go|rs|cs|css|scss|html|json|yaml|yml)$/.test(review.file_path)
          && fs.existsSync(path.join(projectPath, review.file_path));

        if (!isValidFilePath) {
          db.updateReview(review.id, {
            status: 'confirmed',
            resolved_at: new Date().toISOString(),
          });
          confirmed++;

          // Update associated task status to 'completed' for confirmed reviews
          try {
            const tasks = db.getTasksByReviewId(review.id);
            for (const task of tasks) {
              db.updateTask(task.id, {
                status: 'completed',
                updated_at: new Date().toISOString(),
              });
            }
          } catch (error: any) {
            logger.warn(`[DesignChecker] Failed to update tasks for review ${review.id}: ${error.message}`);
          }
        } else {
          const filePath = review.file_path!;
          const fix = await codeReviewer.generateFix(
            projectPath,
            filePath,
            {
              title: review.title,
              description: review.description || review.title,
              suggestion: review.suggestion || undefined,
            }
          );

          if (!fix) {
            failed++;
            continue;
          }

          const fullPath = path.join(projectPath, filePath);
          const resolvedPath = path.resolve(fullPath);
          if (!resolvedPath.startsWith(path.resolve(projectPath))) {
            failed++;
            continue;
          }

          await fs.promises.writeFile(fullPath, fix.fixedContent, 'utf-8');
          db.updateReview(review.id, { status: 'fixed', resolved_at: new Date().toISOString() });
          fixed++;

          // Update associated task status to 'completed' for fixed reviews
          try {
            const tasks = db.getTasksByReviewId(review.id);
            for (const task of tasks) {
              db.updateTask(task.id, {
                status: 'completed',
                updated_at: new Date().toISOString(),
              });
            }
          } catch (error: any) {
            logger.warn(`[DesignChecker] Failed to update tasks for review ${review.id}: ${error.message}`);
          }
        }
      } catch (error: any) {
        logger.error(`[DesignChecker] Auto-fix failed for review ${review.id}: ${error.message}`);
        failed++;
      }
    }

    return { fixed, confirmed, failed };
  }

  /**
   * Git commit and push fixed files
   */
  private async commitAndPush(projectPath: string, projectName: string, fixedCount: number): Promise<void> {
    try {
      const git = simpleGit(projectPath);

      // Check if it's a git repo
      const isRepo = await git.status().then(() => true).catch(() => false);
      if (!isRepo) {
        logger.info(`[DesignChecker] "${projectName}" is not a git repo, skipping commit`);
        return;
      }

      // Check for changes
      const status = await git.status();
      if (status.staged.length === 0 && status.modified.length === 0 && status.not_added.length === 0) {
        logger.info(`[DesignChecker] No changes to commit for "${projectName}"`);
        return;
      }

      // Stage all changes
      await git.add('-A');

      // Commit
      const commitMsg = `fix(auto): design consistency auto-fix (${fixedCount} files)`;
      await git.commit(commitMsg);

      // Push to remote
      const remotes = await git.getRemotes();
      if (remotes.length > 0) {
        const branch = status.current || 'main';
        await git.push('origin', branch);
        logger.info(`[DesignChecker] Pushed auto-fix commit to "${projectName}" (${branch})`);
      } else {
        logger.info(`[DesignChecker] No remote configured for "${projectName}", commit only`);
      }
    } catch (error: any) {
      logger.error(`[DesignChecker] Git commit/push failed for "${projectName}": ${error.message}`);
    }
  }

  /**
   * Try to infer the correct file path from an invalid one.
   * Uses keyword matching between the finding title/description and source file paths.
   */
  private inferFilePath(
    invalidPath: string,
    title: string,
    description: string,
    sourceFiles: Array<{ relativePath: string }>
  ): string | null {
    const text = `${title} ${description}`.toLowerCase();

    // Priority-ordered keyword → file path mapping
    // More specific patterns first, broader patterns later
    const keywordPatterns: Array<{ pattern: RegExp; filePattern: RegExp }> = [
      // DesignChecker itself
      { pattern: /designcheck|design.?checker/, filePattern: /designChecker\.ts$/ },
      // Review routes (审查 + 端点/路由/批准/忽略/修复)
      { pattern: /审查.*(端点|路由|批准|忽略|修复|fix)|review.*(route|endpoint|fix)/, filePattern: /routes\/reviews?\.ts$/ },
      // Chat/WebSocket + endpoint/route
      { pattern: /(聊天|chat|websocket|ws|sse).*(端点|路由|endpoint|route)|endpoint.*(chat|sse|ws)/, filePattern: /routes\/teams?\.ts$/ },
      // Config routes
      { pattern: /配置.*(路由|route|endpoint|端点)/, filePattern: /routes\/config\.ts$/ },
      // Task + dashboard store
      { pattern: /任务.*(状态|同步|store|dashboard)|dashboard.*task/, filePattern: /stores\/dashboard\.ts$/ },
      // Chat + create task
      { pattern: /聊天.*创建.*任务|chat.*create.*task/, filePattern: /routes\/teams?\.ts$/ },
      // Scanner/DesignChecker
      { pattern: /扫描|scanner/, filePattern: /designChecker\.ts$/ },
      // Review (broader)
      { pattern: /审查|review/, filePattern: /routes\/reviews?\.ts$/ },
      // Chat/WebSocket (broader)
      { pattern: /聊天|chat|websocket|ws|sse/, filePattern: /routes\/teams?\.ts$/ },
      // Task-related
      { pattern: /任务|task/, filePattern: /stores\/dashboard\.ts$/ },
      // Config
      { pattern: /配置|config/, filePattern: /config\.ts$/ },
      // Analysis pipeline
      { pattern: /分析|analysis|pipeline/, filePattern: /pipeline\.ts$/ },
      // State management
      { pattern: /状态|state|store|pinia/, filePattern: /stores?\/.*\.ts$/ },
      // API routes
      { pattern: /路由|route|endpoint|端点/, filePattern: /routes?\/.*\.ts$/ },
      // Database
      { pattern: /数据库|database|sqlite|db/, filePattern: /db\.ts$/ },
      // Knowledge base
      { pattern: /知识库|knowledge/, filePattern: /knowledge\/.*\.ts$/ },
    ];

    // Try keyword matching (first match wins due to priority ordering)
    for (const { pattern, filePattern } of keywordPatterns) {
      if (pattern.test(text)) {
        const match = sourceFiles.find(f => filePattern.test(f.relativePath));
        if (match) return match.relativePath;
      }
    }

    // Try partial path matching (e.g., "reviews.ts" in "设计文档" might match "src/worker/routes/reviews.ts")
    const invalidParts = invalidPath.replace(/[/\\]/g, ' ').split(/\s+/).filter(p => p.length > 2);
    for (const part of invalidParts) {
      const match = sourceFiles.find(f => f.relativePath.toLowerCase().includes(part.toLowerCase()));
      if (match) return match.relativePath;
    }

    return null;
  }
}