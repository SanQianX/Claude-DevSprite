/**
 * Analysis Progress Tracker
 * In-memory state tracker that broadcasts progress updates via SSE.
 */

import { sseBroadcaster } from './sseBroadcaster';
import { createLogger } from '../utils/logger';

const logger = createLogger('analysis-tracker');

export type AnalysisStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface AnalysisProgress {
  status: AnalysisStatus;
  projectName: string | null;
  commitHash: string | null;
  mode: 'incremental' | 'full' | null;
  currentStep: string;
  progress: number;
  startedAt: number | null;
  queueDepth: number;
  lastError: string | null;
  lastCompletedAt: number | null;
}

const initialState: AnalysisProgress = {
  status: 'idle',
  projectName: null,
  commitHash: null,
  mode: null,
  currentStep: '',
  progress: 0,
  startedAt: null,
  queueDepth: 0,
  lastError: null,
  lastCompletedAt: null,
};

class AnalysisTracker {
  private state: AnalysisProgress = { ...initialState };

  startAnalysis(projectName: string, commitHash: string | null, mode: 'incremental' | 'full'): void {
    this.state = {
      ...initialState,
      status: 'running',
      projectName,
      commitHash,
      mode,
      currentStep: 'starting',
      progress: 0,
      startedAt: Date.now(),
      queueDepth: this.state.queueDepth + 1,
    };
    this.broadcast();
    logger.info(`Analysis started: ${projectName} (${mode})`);
  }

  updateStep(step: string, progress: number): void {
    if (this.state.status !== 'running') return;
    this.state.currentStep = step;
    this.state.progress = Math.min(100, Math.max(0, progress));
    this.broadcast();
  }

  completeAnalysis(): void {
    this.state.status = 'completed';
    this.state.progress = 100;
    this.state.currentStep = 'completed';
    this.state.lastCompletedAt = Date.now();
    this.state.queueDepth = Math.max(0, this.state.queueDepth - 1);
    this.broadcast();
    logger.info('Analysis completed');
  }

  failAnalysis(error: string): void {
    this.state.status = 'failed';
    this.state.lastError = error;
    this.state.currentStep = 'failed';
    this.state.queueDepth = Math.max(0, this.state.queueDepth - 1);
    this.broadcast();
    logger.error(`Analysis failed: ${error}`);
  }

  getState(): AnalysisProgress {
    return { ...this.state };
  }

  private broadcast(): void {
    sseBroadcaster.broadcast({
      type: 'analysis_progress',
      ...this.state,
    });
  }
}

export const analysisTracker = new AnalysisTracker();
