/**
 * @fileoverview TransferManager - Simplified Version
 * @description Core transfer management with essential features
 */

import { v4 as uuidv4 } from 'uuid';
import type { TransferDatabase } from './database';
import { MTPWrapper } from './mtp-wrapper';
import type { FileComparisonResult } from './types/file-differ-types';
import type { 
  TransferManagerOptions, 
  TransferOptions, 
  TransferResult, 
  QueueStatus,
  TransferSession,
  TransferTask
} from './types/transfer-manager-types';

/**
 * TransferManager 主類別 (簡化版)
 * 負責協調檔案傳輸、狀態管理和錯誤處理
 */
export class TransferManager {
  private db: TransferDatabase;
  private mtpWrapper: MTPWrapper;
  private options: Required<Pick<TransferManagerOptions, 'concurrency' | 'retryLimit' | 'retryDelay' | 'chunkSize'>>;
  
  // Session 管理
  private activeSessions = new Map<string, TransferSession>();
  private activeTransfers = new Map<string, TransferTask>();
  
  // 回調函數
  private progressCallback?: TransferManagerOptions['onProgress'];
  private errorCallback?: TransferManagerOptions['onError'];
  private completeCallback?: TransferManagerOptions['onComplete'];
  private fileStartCallback?: TransferManagerOptions['onFileStart'];
  private fileCompleteCallback?: TransferManagerOptions['onFileComplete'];

  constructor(options: TransferManagerOptions) {
    this.db = options.db;
    this.mtpWrapper = options.mtpWrapper || new MTPWrapper();
    
    // 合併選項與預設值
    this.options = {
      concurrency: options.concurrency || 3,
      retryLimit: options.retryLimit || 3,
      retryDelay: options.retryDelay || 1000,
      chunkSize: options.chunkSize || 1024 * 1024
    };
    
    // 設定回調
    this.progressCallback = options.onProgress;
    this.errorCallback = options.onError;
    this.completeCallback = options.onComplete;
    this.fileStartCallback = options.onFileStart;
    this.fileCompleteCallback = options.onFileComplete;
  }

  /**
   * 開始新的傳輸
   */
  async startTransfer(localPath: string, options: TransferOptions = {}): Promise<TransferResult> {
    const sessionId = options.sessionId || uuidv4();
    
    try {
      // 偵測 MTP 裝置
      const device = await this.mtpWrapper.detectDevice();
      if (!device || !device.connected) {
        throw this.createError('NO_DEVICE', 'No MTP device connected');
      }

      // 建立 session
      const session = this.createSession(sessionId, localPath, options);
      
      // 掃描並比對檔案
      const comparison = await this.scanAndCompare(localPath, options.filter);
      
      // 準備傳輸任務
      const tasks = await this.prepareTasks(comparison, session, options);
      
      // 模擬傳輸過程
      session.totalFiles = tasks.length;
      session.totalSize = tasks.reduce((sum, task) => sum + task.file.size, 0);
      
      // 執行傳輸
      for (const task of tasks) {
        await this.executeTransferTask(task);
      }
      
      // 建立結果
      const result = await this.createTransferResult(session);
      
      // 觸發完成回調
      this.completeCallback?.(result);
      
      return result;
      
    } catch (error) {
      const transferError = this.createError('TRANSFER_FAILED', `Transfer failed: ${(error as Error).message}`, error);
      (transferError as any).session = sessionId;
      throw transferError;
    }
  }

  /**
   * 掃描並比對檔案
   */
  async scanAndCompare(_localPath: string, _filter?: TransferOptions['filter']): Promise<FileComparisonResult> {
    // 取得 MTP 裝置檔案
    const mtpFiles = await this.mtpWrapper.listFiles('/', { recursive: true });
    
    // 簡化的比對邏輯 - 實際實作需要 FileDiffer
    const newFiles: any[] = [];
    const modifiedFiles: any[] = [];
    const duplicateFiles: any[] = [];
    
    // 模擬檔案比對結果
    return {
      newFiles,
      modifiedFiles,
      duplicateFiles,
      stats: {
        totalLocalFiles: 0,
        totalMtpFiles: mtpFiles.length,
        newFilesCount: newFiles.length,
        modifiedFilesCount: modifiedFiles.length,
        duplicateFilesCount: duplicateFiles.length
      }
    };
  }

  /**
   * 取得佇列狀態
   */
  getQueueStatus(): QueueStatus {
    return {
      pending: 0,
      running: this.activeTransfers.size,
      completed: 0,
      failed: 0,
      total: 0
    };
  }

  /**
   * 暫停傳輸
   */
  async pauseTransfer(): Promise<void> {
    this.activeSessions.forEach(session => {
      session.status = 'paused';
    });
  }

  /**
   * 恢復傳輸
   */
  async resumeTransfer(): Promise<void> {
    this.activeSessions.forEach(session => {
      if (session.status === 'paused') {
        session.status = 'active';
      }
    });
  }

  // Private methods

  /**
   * 建立 session
   */
  private createSession(sessionId: string, localPath: string, options: TransferOptions): TransferSession {
    const session: TransferSession = {
      id: sessionId,
      localPath,
      destination: 'MTP Device',
      status: 'active',
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
      totalSize: 0,
      transferredSize: 0,
      startTime: new Date(),
      options
    };
    
    this.activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * 準備傳輸任務
   */
  private async prepareTasks(comparison: FileComparisonResult, session: TransferSession, options: TransferOptions): Promise<TransferTask[]> {
    const tasks: TransferTask[] = [];
    
    // 需要傳輸的檔案：新檔案 + 修改檔案（如果允許覆蓋）
    const filesToTransfer = [...comparison.newFiles];
    if (options.overwrite) {
      filesToTransfer.push(...comparison.modifiedFiles);
    }
    
    // 建立任務
    filesToTransfer.forEach((file, index) => {
      tasks.push({
        id: `${session.id}-${file.path}`,
        file,
        destination: 'MTP Device',
        retries: 0,
        status: 'pending',
        priority: index
      });
    });
    
    return tasks;
  }

  /**
   * 執行傳輸任務
   */
  private async executeTransferTask(task: TransferTask): Promise<void> {
    const maxRetries = this.options.retryLimit;
    
    while (task.retries <= maxRetries) {
      try {
        this.handleTaskStart(task);
        
        // 建立傳輸記錄
        const newRecord = {
          file_path: task.file.path,
          file_size: task.file.size,
          status: 'transferring' as const
        };
        
        this.db.addTransfer(newRecord);
        
        // 模擬傳輸
        await this.simulateTransfer(task);
        
        // 更新狀態為完成
        const records = await this.db.getTransfers();
        const record = records.find(r => r.file_path === task.file.path && r.file_size === task.file.size);
        if (record) {
          this.db.updateTransfer(record.id, { status: 'completed' });
        }
        
        this.handleTaskComplete(task);
        return;
        
      } catch (error) {
        task.retries++;
        task.error = error as Error;
        
        if (task.retries > maxRetries) {
          // 最終失敗
          const records = await this.db.getTransfers();
          const record = records.find(r => r.file_path === task.file.path && r.file_size === task.file.size);
          if (record) {
            this.db.updateTransfer(record.id, { 
              status: 'failed', 
              error: (error as Error).message 
            });
          }
          
          this.handleTaskError(task, error as Error);
          throw error;
        }
        
        // 重試延遲
        await this.delay(this.options.retryDelay * Math.pow(2, task.retries - 1));
      }
    }
  }

  /**
   * 模擬傳輸 (暫時實作)
   */
  private async simulateTransfer(task: TransferTask): Promise<void> {
    // 模擬進度
    for (let i = 0; i <= 100; i += 10) {
      await this.delay(100);
      
      const progress = {
        fileId: 1, // Mock file ID
        fileName: task.file.fileName,
        percentage: i,
        bytesTransferred: (i / 100) * task.file.size,
        totalBytes: task.file.size,
        speed: task.file.size / 10, // Mock speed
        estimatedTimeRemaining: (100 - i) / 10 // Mock ETA
      };
      
      this.handleFileProgress(task, progress);
    }
  }

  /**
   * 處理檔案傳輸進度
   */
  private handleFileProgress(task: TransferTask, progress: any): void {
    // 更新任務進度
    task.transferredBytes = progress.bytesTransferred;
    
    // 計算整體進度
    const overallProgress = this.calculateOverallProgress();
    
    // 觸發進度回調
    this.progressCallback?.({
      currentFile: task.file.fileName,
      currentFileProgress: progress.percentage,
      overallProgress: overallProgress.percentage,
      filesCompleted: overallProgress.completed,
      filesTotal: overallProgress.total,
      bytesTransferred: overallProgress.bytesTransferred,
      bytesTotal: overallProgress.bytesTotal,
      currentSpeed: progress.speed,
      estimatedTimeRemaining: progress.speed ? 
        Math.round((overallProgress.bytesTotal - overallProgress.bytesTransferred) / progress.speed) : 
        0,
      status: 'transferring'
    });
  }

  /**
   * 處理任務開始
   */
  private handleTaskStart(task: TransferTask): void {
    this.activeTransfers.set(task.id, task);
    this.fileStartCallback?.(task.file);
  }

  /**
   * 處理任務完成
   */
  private handleTaskComplete(task: TransferTask): void {
    this.activeTransfers.delete(task.id);
    
    // 更新 session 統計
    const sessionId = task.id.split('-')[0];
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.completedFiles++;
      session.transferredSize += task.file.size;
    }
    
    this.fileCompleteCallback?.(task.file, true);
  }

  /**
   * 處理任務錯誤
   */
  private handleTaskError(task: TransferTask, error: Error): void {
    this.activeTransfers.delete(task.id);
    
    // 更新 session 統計
    const sessionId = task.id.split('-')[0];
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.failedFiles++;
    }
    
    this.errorCallback?.(error, task.file);
    this.fileCompleteCallback?.(task.file, false, error);
  }

  /**
   * 計算整體進度
   */
  private calculateOverallProgress() {
    let totalFiles = 0;
    let completedFiles = 0;
    let totalBytes = 0;
    let transferredBytes = 0;
    
    this.activeSessions.forEach(session => {
      totalFiles += session.totalFiles;
      completedFiles += session.completedFiles;
      totalBytes += session.totalSize;
      transferredBytes += session.transferredSize;
    });
    
    // 加上當前正在傳輸的進度
    this.activeTransfers.forEach(task => {
      transferredBytes += task.transferredBytes || 0;
    });
    
    const percentage = totalBytes > 0 ? (transferredBytes / totalBytes) * 100 : 0;
    
    return {
      percentage: Math.round(percentage * 100) / 100,
      completed: completedFiles,
      total: totalFiles,
      bytesTransferred: transferredBytes,
      bytesTotal: totalBytes
    };
  }

  /**
   * 建立傳輸結果
   */
  private async createTransferResult(session: TransferSession): Promise<TransferResult> {
    const successful: any[] = [];
    const failed: any[] = [];
    const skipped: any[] = [];
    
    // 從資料庫取得結果
    const records = await this.db.getTransfers();
    records.forEach(record => {
      if (record.status === 'completed') {
        successful.push(record);
      } else if (record.status === 'failed') {
        failed.push(record);
      }
    });
    
    // 計算統計
    const stats = {
      totalFiles: session.totalFiles,
      successCount: session.completedFiles,
      failureCount: session.failedFiles,
      skippedCount: session.skippedFiles,
      totalBytes: session.totalSize,
      transferredBytes: session.transferredSize,
      duration: Date.now() - session.startTime.getTime(),
      averageSpeed: 0,
      startTime: session.startTime,
      endTime: new Date()
    };
    
    stats.averageSpeed = stats.duration > 0 
      ? stats.transferredBytes / (stats.duration / 1000)
      : 0;
    
    const batch = {
      sessionId: session.id,
      successful,
      failed,
      skipped,
      stats
    };
    
    const result: TransferResult = {
      success: session.status === 'completed' || session.failedFiles === 0,
      session,
      batch
    };
    
    if (session.status === 'failed') {
      result.error = new Error(session.error || 'Transfer failed');
    }
    
    return result;
  }

  /**
   * 建立錯誤物件
   */
  private createError(code: string, message: string, originalError?: any): Error {
    const error = new Error(message);
    (error as any).code = code;
    (error as any).details = originalError;
    return error;
  }

  /**
   * 延遲函數
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}