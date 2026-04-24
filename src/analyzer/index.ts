/**
 * Analyzer Entry Point
 * Orchestrates the AI analysis pipeline
 */

import type { AnalysisContext, AIAnalysisResult } from './types';
import { AnalysisPipeline } from './pipeline';

export class Analyzer {
  private pipelines: Map<string, AnalysisPipeline> = new Map();

  constructor() {}

  /**
   * Analyze a commit and generate knowledge base documents
   */
  async analyze(repoPath: string, commitHash: string, aiConfig?: { model?: string; apiKey?: string }): Promise<AIAnalysisResult> {
    // Get or create pipeline for this repo
    let pipeline = this.pipelines.get(repoPath);
    if (!pipeline) {
      pipeline = new AnalysisPipeline(repoPath, aiConfig);
      this.pipelines.set(repoPath, pipeline);
    }

    return await pipeline.execute(commitHash);
  }

  /**
   * Analyze with pre-built context
   */
  async analyzeWithContext(context: AnalysisContext, aiConfig?: { model?: string; apiKey?: string }): Promise<AIAnalysisResult> {
    const repoPath = context.repoPath;

    // Get or create pipeline for this repo
    let pipeline = this.pipelines.get(repoPath);
    if (!pipeline) {
      pipeline = new AnalysisPipeline(repoPath, aiConfig);
      this.pipelines.set(repoPath, pipeline);
    }

    return await pipeline.executeWithContext(context);
  }

  /**
   * Get pipeline for a specific repo
   */
  getPipeline(repoPath: string): AnalysisPipeline | undefined {
    return this.pipelines.get(repoPath);
  }

  /**
   * Clear all pipelines
   */
  clear(): void {
    this.pipelines.clear();
  }
}

export * from './types';
export * from './pipeline';
export * from './diffCollector';
export * from './contextBuilder';
export * from './modeDecider';
export * from './documentGenerator';
export * from './promptBuilder';
export * from './promptTemplates';
export * from './aiProvider';
export * from './responseParser';
