/**
 * Analysis API Routes
 * POST /api/projects/:name/analyze (incremental)
 * POST /api/projects/:name/analyze/full (full project analysis)
 * GET /api/projects/:name/analysis-log
 * GET /api/projects/:name/analysis-status
 */

import type { Express, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { getDatabase } from '../db';
import { Analyzer } from '../../analyzer';
import { AIProvider } from '../../analyzer/aiProvider';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { createLogger } from '../../utils/logger';
import { getProjectDiscoveryService } from '../../services/projectDiscovery';
import { config } from '../../config';

const logger = createLogger('analysis');

// Global analyzer instance
let analyzer: Analyzer | null = null;

export function registerAnalysisRoutes(app: Express): void {
  /**
   * POST /api/projects/:name/analyze/full
   * Full project analysis - generates initial knowledge base
   */
  app.post('/api/projects/:name/analyze/full', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    try {
      const discovery = getProjectDiscoveryService();
      const project = await discovery.getProject(name);
      if (!project) {
        throw createError('Project not found', 404);
      }

      const projectPath = project.path;
      logger.info(`[AnalysisRoutes] Starting full project analysis for ${name}`);

      // 1. Collect project structure
      const projectStructure = collectProjectStructure(projectPath);

      // 2. Collect key source files
      const sourceFiles = collectKeySourceFiles(projectPath);

      // 3. Collect existing knowledge (if any)
      const existingKnowledge = collectExistingKnowledge(project.knowledgePath);

      // 4. Build the full analysis prompt
      const prompt = buildFullAnalysisPrompt(name, projectPath, projectStructure, sourceFiles, existingKnowledge);

      // 5. Call AI
      logger.info(`[AnalysisRoutes] Calling AI for full analysis (prompt length: ${prompt.length})`);
      const aiProvider = new AIProvider();
      const aiResponse = await aiProvider.callAI(prompt);

      // 6. Parse and write documents
      const documents = parseDocuments(aiResponse.content);

      const knowledgePath = project.knowledgePath;
      if (!fs.existsSync(knowledgePath)) {
        fs.mkdirSync(knowledgePath, { recursive: true });
      }

      let writtenCount = 0;
      for (const doc of documents) {
        const docPath = path.join(knowledgePath, doc.path);
        const docDir = path.dirname(docPath);

        if (!fs.existsSync(docDir)) {
          fs.mkdirSync(docDir, { recursive: true });
        }

        fs.writeFileSync(docPath, doc.content, 'utf-8');
        logger.info(`[AnalysisRoutes] Wrote document: ${doc.path}`);
        writtenCount++;
      }

      // Always write a README.md for the knowledge base
      const readmePath = path.join(knowledgePath, 'README.md');
      if (!fs.existsSync(readmePath)) {
        fs.writeFileSync(readmePath, `# ${name} 知识库\n\n本项目知识库由 Claude-DevSprite 自动生成和维护。\n\n## 文档目录\n\n请浏览左侧文件树查看项目知识库文档。\n`, 'utf-8');
        writtenCount++;
      }

      // 7. Update project in database
      const db = await getDatabase();
      const simpleGit = (await import('simple-git')).default;
      const git = simpleGit(projectPath);
      const log = await git.log({ maxCount: 1 });

      db.updateProject(project.id, {
        last_analysis_commit: log.latest?.hash || null,
        last_full_analysis: new Date().toISOString(),
      });
      db.incrementAnalysisCount(project.id);

      res.json({
        projectName: name,
        status: 'completed',
        mode: 'full',
        documentsGenerated: writtenCount,
        modelUsed: aiResponse.model,
        tokensUsed: aiResponse.tokensUsed,
        durationMs: 0,
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[AnalysisRoutes] Full analysis failed:', error);
      throw createError('Full analysis failed: ' + message, 500, error);
    }
  }));

  /**
   * POST /api/projects/:name/analyze
   * Incremental analysis (commit-based)
   */
  app.post('/api/projects/:name/analyze', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;
    const { commitHash, mode } = req.body;

    try {
      const discovery = getProjectDiscoveryService();
      const project = await discovery.getProject(name);
      if (!project) {
        throw createError('Project not found', 404);
      }
      const projectPath = project.path;

      if (!analyzer) {
        analyzer = new Analyzer();
      }

      let targetCommitHash = commitHash;
      if (!targetCommitHash) {
        const simpleGit = (await import('simple-git')).default;
        const git = simpleGit(projectPath);
        const log = await git.log({ maxCount: 1 });
        targetCommitHash = log.latest?.hash;
      }

      if (!targetCommitHash) {
        throw createError('No commit hash found', 400);
      }

      logger.info(`[AnalysisRoutes] Starting incremental analysis for ${name} at commit ${targetCommitHash}`);

      const result = await analyzer.analyze(projectPath, targetCommitHash);

      const knowledgePath = project.knowledgePath;
      if (!fs.existsSync(knowledgePath)) {
        fs.mkdirSync(knowledgePath, { recursive: true });
      }

      for (const doc of result.documents) {
        const docPath = path.join(knowledgePath, doc.path);
        const docDir = path.dirname(docPath);

        if (!fs.existsSync(docDir)) {
          fs.mkdirSync(docDir, { recursive: true });
        }

        fs.writeFileSync(docPath, doc.content, 'utf-8');
        logger.info(`[AnalysisRoutes] Wrote document: ${doc.path}`);
      }

      const db = await getDatabase();
      db.updateProject(project.id, {
        last_analysis_commit: targetCommitHash,
      });
      db.incrementAnalysisCount(project.id);

      res.json({
        projectName: name,
        status: 'completed',
        commitHash: targetCommitHash,
        documentsGenerated: result.documents.length,
        modelUsed: result.modelUsed,
        tokensUsed: result.tokensUsed,
        durationMs: result.durationMs,
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[AnalysisRoutes] Analysis failed:', error);
      throw createError('Analysis failed', 500, error);
    }
  }));

  /**
   * GET /api/projects/:name/analysis-log
   */
  app.get('/api/projects/:name/analysis-log', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;
    const { limit } = req.query;

    try {
      const discovery = getProjectDiscoveryService();
      const project = await discovery.getProject(name);
      if (!project) {
        throw createError('Project not found', 404);
      }

      const db = await getDatabase();
      const logs = db.getAnalysisLogs(
        project.id,
        limit ? parseInt(limit as string) : 10
      );

      res.json({
        projectName: name,
        logs,
        limit: limit ? parseInt(limit as string) : 10,
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting analysis log', error);
      throw createError('Failed to get analysis log', 500, error);
    }
  }));

  /**
   * GET /api/projects/:name/analysis-status
   */
  app.get('/api/projects/:name/analysis-status', asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    try {
      const discovery = getProjectDiscoveryService();
      const project = await discovery.getProject(name);
      if (!project) {
        throw createError('Project not found', 404);
      }

      const db = await getDatabase();
      const logs = db.getAnalysisLogs(project.id, 1);
      const lastAnalysis = logs.length > 0 ? logs[0] : null;

      res.json({
        projectName: name,
        status: 'idle',
        lastAnalysis: lastAnalysis ? {
          commitHash: lastAnalysis.commit_hash,
          commitMessage: lastAnalysis.commit_message,
          status: lastAnalysis.status,
          timestamp: lastAnalysis.created_at,
          modelUsed: lastAnalysis.model_used,
          tokensUsed: lastAnalysis.tokens_used,
          durationMs: lastAnalysis.duration_ms,
        } : null,
        queuedAnalyses: 0,
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting analysis status', error);
      throw createError('Failed to get analysis status', 500, error);
    }
  }));
}

// ==========================================
// Helper functions for full project analysis
// ==========================================

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  'coverage', '.nyc_output', '.cache', '.vscode', '.idea',
  '__pycache__', '.pytest_cache', 'vendor', 'target', 'bin',
  'obj', '.terraform', '.serverless', 'test-results'
]);

const IGNORE_FILES = new Set([
  '.DS_Store', 'Thumbs.db', '.env', '.env.local', '.env.production'
]);

const MAX_FILE_SIZE = 50 * 1024; // 50KB max per file
const MAX_TOTAL_SIZE = 500 * 1024; // 500KB total for all source files
const MAX_SOURCE_FILES = 30;

function collectProjectStructure(projectPath: string): string {
  const lines: string[] = [];

  function walk(dir: string, prefix: string, depth: number): void {
    if (depth > 4) return; // Max depth

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

      for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        if (IGNORE_FILES.has(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          lines.push(`${prefix}${entry.name}/`);
          walk(fullPath, prefix + '  ', depth + 1);
        } else {
          lines.push(`${prefix}${entry.name}`);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  walk(projectPath, '', 0);
  return lines.join('\n');
}

function collectKeySourceFiles(projectPath: string): string {
  const files: { path: string; content: string }[] = [];
  let totalSize = 0;

  // Priority files to include
  const priorityFiles = [
    'package.json', 'tsconfig.json', 'README.md', 'ARCHITECTURE.md',
    'CLAUDE.md', 'vite.config.ts', 'vite.config.js', 'webpack.config.js',
    '.env.example', 'docker-compose.yml'
  ];

  // First, add priority files
  for (const file of priorityFiles) {
    const filePath = path.join(projectPath, file);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.size <= MAX_FILE_SIZE) {
        const content = fs.readFileSync(filePath, 'utf-8');
        files.push({ path: file, content });
        totalSize += content.length;
      }
    }
  }

  // Key source directories to scan
  const sourceDirs = ['src', 'lib', 'app', 'web/src', 'web/lib'];

  for (const dir of sourceDirs) {
    const dirPath = path.join(projectPath, dir);
    if (!fs.existsSync(dirPath)) continue;

    const sourceFiles = scanSourceFiles(dirPath, projectPath);

    for (const file of sourceFiles) {
      if (files.length >= MAX_SOURCE_FILES) break;
      if (totalSize >= MAX_TOTAL_SIZE) break;
      if (files.some(f => f.path === file.relativePath)) continue;

      try {
        const content = fs.readFileSync(file.fullPath, 'utf-8');
        if (content.length <= MAX_FILE_SIZE) {
          // Truncate very long files
          const truncated = content.length > 5000
            ? content.substring(0, 5000) + '\n... (truncated)'
            : content;
          files.push({ path: file.relativePath, content: truncated });
          totalSize += truncated.length;
        }
      } catch (error) {
        // Skip files we can't read
      }
    }
  }

  // Format as string
  return files.map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\`\n`).join('\n');
}

function scanSourceFiles(dir: string, projectRoot: string): { fullPath: string; relativePath: string }[] {
  const result: { fullPath: string; relativePath: string }[] = [];

  const extensions = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte',
    '.py', '.go', '.rs', '.java', '.rb', '.php',
    '.css', '.scss', '.html'
  ]);

  function walk(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.has(ext)) {
            result.push({ fullPath, relativePath });
          }
        }
      }
    } catch (error) {
      // Skip
    }
  }

  walk(dir);
  return result;
}

function collectExistingKnowledge(knowledgePath: string): string {
  if (!fs.existsSync(knowledgePath)) {
    return 'No existing knowledge base found.';
  }

  const files: string[] = [];

  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.name.endsWith('.md')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const relativePath = path.relative(knowledgePath, fullPath).replace(/\\/g, '/');
          files.push(`### ${relativePath}\n${content.substring(0, 2000)}`);
        }
      }
    } catch (error) {
      // Skip
    }
  }

  walk(knowledgePath);

  if (files.length === 0) {
    return 'No existing knowledge base documents found.';
  }

  return files.join('\n\n---\n\n');
}

function buildFullAnalysisPrompt(
  projectName: string,
  projectRoot: string,
  projectStructure: string,
  sourceFiles: string,
  existingKnowledge: string
): string {
  return `# Full Project Analysis Request

You are an expert software architect analyzing a complete codebase to generate a comprehensive knowledge base.

## Project: ${projectName}
## Root Path: ${projectRoot}

## Project Structure
${projectStructure}

## Key Source Files
${sourceFiles}

## Existing Knowledge
${existingKnowledge}

---

Please analyze this project and generate a comprehensive knowledge base. Generate the following documents:

1. **project-overview/01-overview.md** - 项目概览：项目目的、核心价值、解决的问题
2. **project-overview/02-architecture.md** - 系统架构：主要组件、数据流、组件如何连接
3. **project-overview/03-modules.md** - 模块分析：关键模块、职责和API
4. **project-overview/04-tech-stack.md** - 技术栈：框架、库、工具及选择原因

IMPORTANT: Respond ONLY with valid JSON in this exact format, with NO markdown code blocks around it:
{"documents":[{"path":"project-overview/01-overview.md","title":"项目概览","category":"overview","content":"---\\ntitle: 项目概览\\ncategory: overview\\n---\\n\\n# 项目概览\\n\\n...detailed content here...","relations":[]}]}

Requirements:
- Each document MUST have YAML frontmatter with title and category (use \\n for newlines in content)
- Use Chinese (中文) for document content and titles
- Include source file references: [source](/project/${projectName}/source?path=src/some/file.ts)
- Content should be detailed and informative, at least 500 characters per document
- Use markdown headers (##, ###), lists, and code blocks for structure
- The relations array should reference related document paths
- Do NOT wrap the JSON in markdown code blocks`;
}

function parseDocuments(aiContent: string): { path: string; title: string; category: string; content: string; relations: string[] }[] {
  try {
    // Try to extract JSON from the response
    let jsonContent = aiContent.trim();

    // Remove markdown code blocks if present
    const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1].trim();
    }

    // Try to find JSON object in the response
    const jsonStart = jsonContent.indexOf('{');
    const jsonEnd = jsonContent.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
    }

    // Fix common JSON issues: escape raw newlines inside string values
    // The AI may return JSON with actual newlines inside string values
    jsonContent = jsonContent.replace(/("(?:[^"\\]|\\.)*")/g, (match) => {
      // Replace literal newlines inside string values with \n
      return match.replace(/\r?\n/g, '\\n');
    });

    const parsed = JSON.parse(jsonContent);
    const documents = parsed.documents || [];

    return documents.map((doc: any) => {
      let content = doc.content || '';
      // The content already has proper newlines from JSON.parse
      // But if the AI used literal \n strings, convert those too
      content = content.replace(/\\n/g, '\n');

      return {
        path: doc.path || `untitled/${Date.now()}.md`,
        title: doc.title || 'Untitled',
        category: doc.category || 'general',
        content,
        relations: Array.isArray(doc.relations) ? doc.relations : [],
      };
    });
  } catch (error) {
    logger.error('[AnalysisRoutes] Failed to parse AI response:', error);
    logger.error('[AnalysisRoutes] Response content (first 500 chars):', aiContent.substring(0, 500));

    // Try a more aggressive approach: extract each document manually
    try {
      return extractDocumentsFallback(aiContent);
    } catch {
      // Return a fallback document with raw content
      return [{
        path: 'project-overview/01-overview.md',
        title: '项目概览',
        category: 'overview',
        content: `---\ntitle: 项目概览\ncategory: overview\n---\n\n# 项目概览\n\nAI 分析结果解析失败，请重新触发分析。\n\n## 原始响应（前1000字符）\n\n\`\`\`\n${aiContent.substring(0, 1000)}\n\`\`\``,
        relations: [],
      }];
    }
  }
}

/**
 * Fallback document extractor - tries to find document content even if JSON parsing fails
 */
function extractDocumentsFallback(aiContent: string): { path: string; title: string; category: string; content: string; relations: string[] }[] {
  const documents: { path: string; title: string; category: string; content: string; relations: any[] }[] = [];

  // Look for markdown content blocks (## headings)
  const mdBlocks = aiContent.split(/(?=^# )/m).filter(b => b.trim().length > 100);

  for (let i = 0; i < mdBlocks.length; i++) {
    const block = mdBlocks[i].trim();
    const titleMatch = block.match(/^#\s+(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : `Document ${i + 1}`;

    documents.push({
      path: `project-overview/${String(i + 1).padStart(2, '0')}-${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')}.md`,
      title,
      category: 'overview',
      content: `---\ntitle: ${title}\ncategory: overview\n---\n\n${block}`,
      relations: [],
    });
  }

  if (documents.length === 0) {
    throw new Error('No documents found in fallback extraction');
  }

  return documents;
}

export function getAnalyzer(): Analyzer | null {
  return analyzer;
}

export function setAnalyzer(a: Analyzer): void {
  analyzer = a;
}
