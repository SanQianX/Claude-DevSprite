/**
 * Task Queue
 * Manages background analysis tasks
 */

export interface Task {
  id: string;
  projectId: string;
  commitHash: string;
  commitMessage: string;
  analysisMode: 'incremental' | 'full';
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export class TaskQueue {
  private queue: Task[] = [];
  private running = new Map<string, Task>();
  private processing = false;

  /**
   * Add a task to the queue
   */
  add(task: Omit<Task, 'id' | 'status' | 'createdAt'>): string {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullTask: Task = {
      ...task,
      id,
      status: 'queued',
      createdAt: new Date(),
    };
    this.queue.push(fullTask);
    return id;
  }

  /**
   * Start processing the queue
   */
  async start(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    this.processQueue();
  }

  /**
   * Stop processing the queue
   */
  stop(): void {
    this.processing = false;
  }

  /**
   * Get all tasks (queued and running)
   */
  getTasks(): Task[] {
    return [...this.queue, ...Array.from(this.running.values())];
  }

  /**
   * Get task by ID
   */
  getTask(id: string): Task | undefined {
    return this.queue.find(t => t.id === id) || this.running.get(id);
  }

  /**
   * Process tasks from the queue
   */
  private async processQueue(): Promise<void> {
    while (this.processing && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      this.running.set(task.id, task);
      task.status = 'running';
      task.startedAt = new Date();

      try {
        // TODO: Execute the task
        await this.executeTask(task);

        task.status = 'completed';
        task.completedAt = new Date();
      } catch (error) {
        task.status = 'failed';
        task.completedAt = new Date();
        task.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      }

      this.running.delete(task.id);
    }

    this.processing = false;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task): Promise<void> {
    // TODO: Implement task execution logic
    console.log(`Executing task: ${task.id} for commit ${task.commitHash}`);
  }
}
