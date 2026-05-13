/**
 * Design Scanner Agent
 * 
 * 独立的设计扫描器模块，用于扫描代码与设计文档的一致性。
 * 与 CodeReviewer 扫描器的区别：DesignScanner 仅扫描并报告不一致，不进行修复或提交。
 * 它定期扫描项目中的设计文档（如 FUNCTIONAL-LOGIC-ANALYSIS.md）和知识库，
 * 并与实际代码进行比较，找出缺失实现、死代码、逻辑不匹配等问题。
 * 
 * 配置方式：通过构造函数传入模型和扫描间隔，或使用 updateConfig 方法动态调整。
 * 扫描结果存储在数据库中，由其他模块（如 DesignFixer）处理修复。
 * 
 * 职责：
 * - 扫描设计文档和知识库
 * - 比较代码与文档的一致性
 * - 报告发现的问题
 * - 不自动修复或提交
 */

import * as fs from 'fs';
import * as path from 'path';
import { AIProvider, type AIConfig } from './aiProvider';
import { getDatabase } from '../worker/db';
import { createLogger } from '../utils/logger';
import { KnowledgeBaseManager } from '../knowledge';

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

const DESIGN_CHECK_PROMPT = `你是一个功能一致性检查专家。请比较“设计文档”和“实际代码”，找出不一致。

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
- file 必须是上面“实际代码”部分中出现的一个源代码文件路径（如 src/analyzer/aiProvider.ts）
- file 必须指向需要修改的源代码文件，不能是“设计文档”、“知识库”等文档名称
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

/**
 * DesignScanner 类
 * 
 * 独立的设计扫描器，负责扫描代码与设计文档的一致性。
 * 与 DesignChecker（向后兼容导出）不同，DesignScanner 提供更灵活的配置和独立扫描逻辑。
 * 
 * 使用示例：
 * const scanner = new DesignScanner({ model: 'gpt-4', scanIntervalMs: 300000 });
 * scanner.startScanner();
 */
export class DesignScanner {
  private aiProvider: AIProvider;
  private scanIntervalMs: number;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private isScanning = false;
  private enabled = true;

  /**
   * 创建 DesignScanner 实例
   * @param options - 可选配置：model（AI模型）、scanIntervalMs（扫描间隔毫秒）、agentConfig（AI配置）
   */
  constructor(options?: { model?: string; scanIntervalMs?: number; agentConfig?: AIConfig }) {
    this.aiProvider = new AIProvider({ model: options?.model, agentConfig: options?.agentConfig });
    this.scanIntervalMs = options?.scanIntervalMs ?? 10 * 60 * 1000; // 10 minutes default
  }

  /**
   * 获取当前扫描器配置
   * @returns ScannerConfig 对象，包含启用状态、扫描间隔和是否正在扫描
   */
  getConfig(): ScannerConfig {
    return {
      enabled: this.enabled,
      intervalMs: this.scanIntervalMs,
      isScanning: this.isScanning,
    };
  }

  /**
   * 更新扫描器配置
   * @param config - 配置对象：enabled（启用状态）、intervalMs（扫描间隔，最小60秒）
   */
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
    logger.info(`[DesignScanner] Config updated: enabled=${this.enabled}, interval=${this.scanIntervalMs}ms`);
  }

  /**
   * 启动后台扫描器
   * 会在指定间隔后自动扫描所有项目，并延迟30秒执行首次扫描
   */
  startScanner(): void {
    if (this.scanTimer) return;
    if (!this.enabled) {
      logger.info('[DesignScanner] Scanner disabled, not starting');
      return;
    }
    logger.info(`[DesignScanner] Starting background scanner (interval: ${this.scanIntervalMs}ms)`);
    this.scanTimer = setInterval(() => this.scanAllProjects(), this.scanIntervalMs);
    // Run initial scan after 30 seconds (delayed to let DB and projects initialize)
    setTimeout(() => this.scanAllProjects(), 30000);
  }

  /**
   * 停止后台扫描器
   */
  stopScanner(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
      logger.info('[DesignScanner] Background scanner stopped');
    }
  }

  /**
   * 扫描所有项目
   * 从数据库获取项目列表，并逐个扫描
   */
  async scanAllProjects(): Promise<void> {
    if (this.isScanning) {
      logger.info('[DesignScanner] Scan already in progress, skipping');
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
          logger.error(`[DesignScanner] Error scanning project ${project.name}: ${error.message}`);
        }
      }
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * 扫描单个项目
   * @param projectId - 项目ID
   * @param projectPath - 项目路径
   * @param projectName - 项目名称
   * @returns 发现的问题数量
   */
  async scanProject(projectId: string, projectPath: string, projectName: string): Promise<number> {
    logger.info(`[DesignScanner] Scanning project "${projectName}"`);

    // 1. Collect design documents from tasks/ directory
    const designDocs = this.collectDesignDocs(projectPath);

    // 2. Collect knowledge base documents
    const kbDocs = await this.collectKnowledgeDocs(projectPath, projectId);

    // 3. Collect key source files
    const sourceFiles = this.collectKeySourceFiles(projectPath);

    if (designDocs.length === 0 && kbDocs.length === 0) {
      logger.info(`[DesignScanner] No design docs or knowledge base found for "${projectName}", skipping`);
      return 0;
    }

    if (sourceFiles.length === 0) {
      logger.info(`[DesignScanner] No source files found for "${projectName}", skipping`);
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
        const inferred = this.inferFilePath(finding.file, finding.title, finding.description, sourceFiles);
        if (inferred) {
          logger.info(`[DesignScanner] Inferred file path: "${finding.file}" → "${inferred}"`);
          finding.file = inferred;
        } else {
          logger.warn(`[DesignScanner] Invalid file path "${finding.file}" for finding "${finding.title}", clearing`);
          finding.file = '';
        }
      }
    }

    // 7. Save findings to database (NO auto-fix)
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
      // NO auto-fix — the fixer agent handles that separately
    }

    logger.info(`[DesignScanner] Project "${projectName}": ${result.findings.length} findings from ${sourceFiles.length} files`);
    return result.findings.length;
  }

  /**
   * 收集设计文档
   * 从项目根目录的 tasks/ 子目录中读取指定的设计文档文件
   * @param projectPath - 项目路径
   * @returns 设计文档数组，每项包含文件名和内容
   */
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
        logger.warn(`[DesignScanner] Failed to read ${fileName}: ${error.message}`);
      }
    }

    return docs;
  }

  /**
   * 收集知识库文档
   * 从知识库管理器中获取文档列表，最多返回10个
   * @param projectPath - 项目路径
   * @param projectId - 项目ID
   * @returns 知识库文档数组
   */
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

      return documents.slice(0, 10).map(doc => ({
        title: doc.title,
        category: doc.category,
        content: doc.content,
      }));
    } catch (error: any) {
      logger.warn(`[DesignScanner] Failed to read knowledge base: ${error.message}`);
      return [];
    }
  }

  /**
   * 收集关键源代码文件
   * 递归扫描 src/ 和 web/src/ 目录，收集代码文件，受限于最大数量和总大小
   * @param projectPath - 项目路径
   * @returns 源文件数组，每项包含相对路径、内容和语言
   */
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

          if (entry.isDirectory()) {
            if (/^\./.test(entry.name) || /^(node_modules|dist|build|\.git|coverage)$/.test(entry.name)) continue;
            collectDir(fullPath, depth + 1);
          } else if (entry.isFile() && CODE_EXTENSIONS.test(entry.name)) {
            try {
              const stat = fs.statSync(fullPath);
              if (stat.size > 50000) continue;

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

    const srcDir = path.join(projectPath, 'src');
    if (fs.existsSync(srcDir)) {
      collectDir(srcDir);
    }

    if (files.length < MAX_SOURCE_FILES) {
      const webSrcDir = path.join(projectPath, 'web', 'src');
      if (fs.existsSync(webSrcDir)) {
        collectDir(webSrcDir);
      }
    }

    return files;
  }

  /**
   * 解析 AI 响应
   * 从 JSON 字符串中提取发现的问题列表
   * @param response - AI 响应对象，包含 content 字符串
   * @param filesReviewed - 已审查的文件数量
   * @returns DesignCheckResult 对象
   */
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
      logger.error('[DesignScanner] Failed to parse AI response:', error);
      return {
        findings: [],
        summary: `解析失败: ${error.message}`,
        filesReviewed,
        modelUsed: '',
      };
    }
  }

  /**
   * 推断文件路径
   * 当 AI 返回无效文件路径时，尝试根据标题和描述推断正确的文件路径
   * @param invalidPath - 无效的文件路径
   * @param title - 问题标题
   * @param description - 问题描述
   * @param sourceFiles - 源文件列表
   * @returns 推断出的相对路径，或 null
   */
  private inferFilePath(
    invalidPath: string,
    title: string,
    description: string,
    sourceFiles: Array<{ relativePath: string }>
  ): string | null {
    const text = `${title} ${description}`.toLowerCase();

    const keywordPatterns: Array<{ pattern: RegExp; filePattern: RegExp }> = [
      { pattern: /designcheck|design.?checker/, filePattern: /designChecker\.ts$/ },
      { pattern: /design.?scanner/, filePattern: /designScanner\.ts$/ },
      { pattern: /design.?fixer/, filePattern: /designFixer\.ts$/ },
      { pattern: /审查.*(端点|路由|批准|忽略|修复|fix)|review.*(route|endpoint|fix)/, filePattern: /routes\/reviews?\.ts$/ },
      { pattern: /(聊天|chat|websocket|ws|sse).*(端点|路由|endpoint|route)|endpoint.*(chat|sse|ws)/, filePattern: /routes\/teams?\.ts$/ },
      { pattern: /配置.*(路由|route|endpoint|端点)/, filePattern: /routes\/config\.ts$/ },
      { pattern: /任务.*(状态|同步|store|dashboard)|dashboard.*task/, filePattern: /stores\/dashboard\.ts$/ },
      { pattern: /聊天.*创建.*任务|chat.*create.*task/, filePattern: /routes\/teams?\.ts$/ },
      { pattern: /扫描|scanner/, filePattern: /designScanner\.ts$/ },
      { pattern: /修复|fixer/, filePattern: /designFixer\.ts$/ },
      { pattern: /审查|review/, filePattern: /routes\/reviews?\.ts$/ },
      { pattern: /聊天|chat|websocket|ws|sse/, filePattern: /routes\/teams?\.ts$/ },
      { pattern: /任务|task/, filePattern: /stores\/dashboard\.ts$/ },
      { pattern: /配置|config/, filePattern: /config\.ts$/ },
      { pattern: /分析|analysis|pipeline/, filePattern: /pipeline\.ts$/ },
      { pattern: /状态|state|store|pinia/, filePattern: /stores?\/.*\.ts$/ },
      { pattern: /路由|route|endpoint|端点/, filePattern: /routes?\/.*\.ts$/ },
      { pattern: /数据库|database|sqlite|db/, filePattern: /db\.ts$/ },
      { pattern: /知识库|knowledge/, filePattern: /knowledge\/.*\.ts$/ },
    ];

    for (const { pattern, filePattern } of keywordPatterns) {
      if (pattern.test(text)) {
        const match = sourceFiles.find(f => filePattern.test(f.relativePath));
        if (match) return match.relativePath;
      }
    }

    const invalidParts = invalidPath.replace(/[/\\]/g, ' ').split(/\s+/).filter(p => p.length > 2);
    for (const part of invalidParts) {
      const match = sourceFiles.find(f => f.relativePath.toLowerCase().includes(part.toLowerCase()));
      if (match) return match.relativePath;
    }

    return null;
  }
}