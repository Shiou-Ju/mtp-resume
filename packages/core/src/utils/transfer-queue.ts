/**
 * @fileoverview TransferQueue - Concurrent Transfer Management
 * @description Manages concurrent file transfers with priority queue and rate limiting
 */

import type { TransferTask } from '../types/transfer-manager-types';

/**
 * 任務執行器類型
 */
export type TaskExecutor = (task: TransferTask) => Promise<void>;

/**
 * 佇列事件
 */
export interface QueueEvents {
  onTaskStart?: (task: TransferTask) => void;
  onTaskComplete?: (task: TransferTask) => void;
  onTaskError?: (task: TransferTask, error: Error) => void;
  onQueueEmpty?: () => void;
}

/**
 * TransferQueue 選項
 */
export interface TransferQueueOptions {
  /** 並行數 (預設: 3) */
  concurrency?: number;
  /** 是否自動開始 (預設: true) */
  autoStart?: boolean;
  /** 佇列事件 */
  events?: QueueEvents;
}

/**
 * 傳輸佇列管理器
 * 控制並行傳輸數量，管理任務優先級
 */
export class TransferQueue {
  private concurrency: number;
  private running: number = 0;
  private queue: TransferTask[] = [];
  private paused: boolean = false;
  private executor?: TaskExecutor;
  private events: QueueEvents;
  private autoStart: boolean;
  private completedTasks = new Set<string>();
  private failedTasks = new Map<string, Error>();

  constructor(options: TransferQueueOptions = {}) {
    this.concurrency = options.concurrency || 3;
    this.autoStart = options.autoStart ?? true;
    this.events = options.events || {};
  }

  /**
   * 設定任務執行器
   */
  public setExecutor(executor: TaskExecutor): void {
    this.executor = executor;
    if (this.autoStart && !this.paused) {
      this.process();
    }
  }

  /**
   * 加入任務到佇列
   */
  public async add(task: TransferTask): Promise<void> {
    // 檢查是否已完成或正在處理
    if (this.completedTasks.has(task.id)) {
      return;
    }

    // 根據優先級插入佇列
    const insertIndex = this.findInsertIndex(task.priority || 0);
    this.queue.splice(insertIndex, 0, task);

    if (this.autoStart && !this.paused && this.executor) {
      this.process();
    }
  }

  /**
   * 批次加入任務
   */
  public async addBatch(tasks: TransferTask[]): Promise<void> {
    // 排序任務並批次插入
    const sortedTasks = tasks
      .filter(task => !this.completedTasks.has(task.id))
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));

    this.queue.push(...sortedTasks);
    
    if (this.autoStart && !this.paused && this.executor) {
      this.process();
    }
  }

  /**
   * 暫停佇列處理
   */
  public pause(): void {
    this.paused = true;
  }

  /**
   * 恢復佇列處理
   */
  public resume(): void {
    this.paused = false;
    if (this.executor) {
      this.process();
    }
  }

  /**
   * 清空佇列
   */
  public clear(): void {
    this.queue = [];
  }

  /**
   * 取得佇列狀態
   */
  public getStatus(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    paused: boolean;
    concurrency: number;
  } {
    return {
      pending: this.queue.length,
      running: this.running,
      completed: this.completedTasks.size,
      failed: this.failedTasks.size,
      paused: this.paused,
      concurrency: this.concurrency
    };
  }

  /**
   * 取得待處理任務
   */
  public getPendingTasks(): TransferTask[] {
    return [...this.queue];
  }

  /**
   * 取得失敗任務
   */
  public getFailedTasks(): Map<string, Error> {
    return new Map(this.failedTasks);
  }

  /**
   * 更新並行數
   */
  public setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency);
    if (!this.paused && this.executor) {
      this.process();
    }
  }

  /**
   * 等待所有任務完成
   */
  public async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        if (this.queue.length === 0 && this.running === 0) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      checkCompletion();
    });
  }

  /**
   * 處理佇列中的任務
   */
  private async process(): Promise<void> {
    if (this.paused || !this.executor) {
      return;
    }

    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      this.running++;
      this.executeTask(task).finally(() => {
        this.running--;
        this.process();
      });
    }

    // 佇列空了
    if (this.queue.length === 0 && this.running === 0) {
      this.events.onQueueEmpty?.();
    }
  }

  /**
   * 執行單個任務
   */
  private async executeTask(task: TransferTask): Promise<void> {
    if (!this.executor) return;

    try {
      // 通知任務開始
      this.events.onTaskStart?.(task);
      task.status = 'transferring';
      task.startTime = new Date();

      // 執行任務
      await this.executor(task);

      // 標記完成
      task.status = 'completed';
      task.endTime = new Date();
      this.completedTasks.add(task.id);
      this.failedTasks.delete(task.id);

      // 通知任務完成
      this.events.onTaskComplete?.(task);

    } catch (error) {
      // 標記失敗
      task.status = 'failed';
      task.endTime = new Date();
      task.error = error as Error;
      this.failedTasks.set(task.id, error as Error);

      // 通知任務錯誤
      this.events.onTaskError?.(task, error as Error);
    }
  }

  /**
   * 找到插入位置 (根據優先級)
   */
  private findInsertIndex(priority: number): number {
    let low = 0;
    let high = this.queue.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if ((this.queue[mid].priority || 0) > priority) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    return low;
  }

  /**
   * 重試失敗的任務
   */
  public retryFailed(): void {
    const failedTasks: TransferTask[] = [];
    
    this.failedTasks.forEach((_error, taskId) => {
      const task = this.queue.find(t => t.id === taskId);
      if (task) {
        task.retries++;
        task.status = 'pending';
        delete task.error;
        failedTasks.push(task);
      }
    });

    this.failedTasks.clear();
    this.addBatch(failedTasks);
  }

  /**
   * 移除特定任務
   */
  public remove(taskId: string): boolean {
    const index = this.queue.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 調整任務優先級
   */
  public updatePriority(taskId: string, newPriority: number): boolean {
    const index = this.queue.findIndex(t => t.id === taskId);
    if (index !== -1) {
      const task = this.queue.splice(index, 1)[0];
      task.priority = newPriority;
      const newIndex = this.findInsertIndex(newPriority);
      this.queue.splice(newIndex, 0, task);
      return true;
    }
    return false;
  }
}