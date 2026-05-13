/**
 * Analysis Pipeline Orchestrator
 * Coordinates the full analysis flow
 */

import type { AnalysisContext, AIAnalysisResult, AnalysisConfig } from './types';
import { DiffCollector } from './diffCollector';
import { ContextBuilder } from './contextBuilder';
import { ModeDecider } from './modeDecider';
import { PromptBuilder } from './promptBuilder';
import { AIProvider } from './aiProvider';
import { ResponseParser } from './responseParser';
import { DocumentGenerator } from './documentGenerator';

export class AnalysisPipeline {
  private diffCollector: DiffCollector;
  private contextBuilder: ContextBuilder;
  private modeDecider: ModeDecider;
  private promptBuilder: PromptBuilder;
  private aiProvider: AIProvider;
  private responseParser: ResponseParser;
  private documentGenerator: DocumentGenerator;
  private config: AnalysisConfig;

  constructor(repoPath: string, aiConfig?: { model?: string; apiKey?: string }) {
    this.diffCollector = new DiffCollector(repoPath);
    this.contextBuilder = new ContextBuilder(repoPath);
    this.modeDecider = new ModeDecider();
    this.promptBuilder = new PromptBuilder();
    this.aiProvider = new AIProvider(aiConfig);
    this.responseParser = new ResponseParser();
    this.documentGenerator = new DocumentGenerator();
    this.config = { maxRetries: 3, retryBaseDelayMs: 500 };
  }

  /**
   * Execute the full analysis pipeline
   */
  async execute(commitHash: string): Promise<AIAnalysisResult> {
    const startTime = Date.now();

    try {
      // 1. Collect diffs
      console.log('[AnalysisPipeline] Step 1: Collecting diffs...');
      const diffs = await this.diffCollector.collectDiffs(commitHash);

      if (diffs.length === 0) {
        console.log('[AnalysisPipeline] No changes detected');
        return {
          documents: [],
          modelUsed: this.aiProvider['model'],
          tokensUsed: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // 2. Build context
      console.log('[AnalysisPipeline] Step 2: Building context...');
      const context = await this.contextBuilder.buildContext(commitHash, diffs);

      // 3. Decide analysis mode
      console.log('[AnalysisPipeline] Step 3: Deciding analysis mode...');
      const mode = this.modeDecider.decideAnalysisMode(diffs);
      context.mode = mode;
      console.log(`[AnalysisPipeline] Analysis mode: ${mode}`);

      // 4. Generate prompt
      console.log('[AnalysisPipeline] Step 4: Generating prompt...');
      const prompt = this.promptBuilder.buildPrompt(context);

      // 5. Call AI provider with retry logic
      console.log('[AnalysisPipeline] Step 5: Calling AI provider...');
      let aiResponse;
      let lastError: Error | undefined;
      const { maxRetries, retryBaseDelayMs } = this.config;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          aiResponse = await this.aiProvider.callAI(prompt);
          break; // Success, exit loop
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < maxRetries) {
            const delay = retryBaseDelayMs * Math.pow(2, attempt);
            console.warn(`[AnalysisPipeline] AI call failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error(`[AnalysisPipeline] AI call failed after ${maxRetries + 1} attempts.`, error);
          }
        }
      }
      if (!aiResponse) {
        throw lastError || new Error('AI call failed after all retries');
      }

      // 6. Parse response
      console.log('[AnalysisPipeline] Step 6: Parsing AI response...');
      const documents = this.documentGenerator.generateDocuments(aiResponse.content);

      const duration = Date.now() - startTime;

      console.log(`[AnalysisPipeline] Analysis completed in ${duration}ms`);
      console.log(`[AnalysisPipeline] Generated ${documents.length} document(s)`);

      return {
        documents,
        modelUsed: aiResponse.model,
        tokensUsed: aiResponse.tokensUsed,
        durationMs: duration,
      };
    } catch (error) {
      console.error('[AnalysisPipeline] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Execute with pre-built context
   */
  async executeWithContext(context: AnalysisContext): Promise<AIAnalysisResult> {
    const startTime = Date.now();

    try {
      // 4. Generate prompt
      const prompt = this.promptBuilder.buildPrompt(context);

      // 5. Call AI provider with retry logic
      let aiResponse;
      let lastError: Error | undefined;
      const { maxRetries, retryBaseDelayMs } = this.config;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          aiResponse = await this.aiProvider.callAI(prompt);
          break; // Success, exit loop
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < maxRetries) {
            const delay = retryBaseDelayMs * Math.pow(2, attempt);
            console.warn(`[AnalysisPipeline] AI call failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error(`[AnalysisPipeline] AI call failed after ${maxRetries + 1} attempts.`, error);
          }
        }
      }
      if (!aiResponse) {
        throw lastError || new Error('AI call failed after all retries');
      }

      // 6. Parse response
      const documents = this.documentGenerator.generateDocuments(aiResponse.content);

      const duration = Date.now() - startTime;

      return {
        documents,
        modelUsed: aiResponse.model,
        tokensUsed: aiResponse.tokensUsed,
        durationMs: duration,
      };
    } catch (error) {
      console.error('[AnalysisPipeline] Analysis with context failed:', error);
      throw error;
    }
  }
}