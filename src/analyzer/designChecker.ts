/**
 * Design Consistency Checker
 * Compares actual code against design docs and knowledge base to find mismatches
 */

import * as fs from 'fs';
import * as path from 'path';
import { AIProvider } from './aiProvider';
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
}
