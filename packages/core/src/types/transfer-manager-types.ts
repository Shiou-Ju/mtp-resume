/**
 * @fileoverview TransferManager Type Definitions
 * @description TypeScript interfaces for file transfer management and orchestration
 */

import type { TransferDatabase } from '../database';
import type { MTPWrapper, MTPFile } from '../mtp-wrapper';
import type { FileDiffer } from '../file-differ';
import type { LocalFile, FileScanOptions } from './file-differ-types';
import type { TransferRecord, TransferStatus } from './database-types';

/**
 * TransferManager 配置選項
 */
export interface TransferManagerOptions {
  /** 資料庫實例 */
  db: TransferDatabase;
  /** MTP 包裝器實例 (可選) */
  mtpWrapper?: MTPWrapper;
  /** 檔案比對器實例 (可選) */
  fileDiffer?: FileDiffer;
  /** 並行傳輸數量 (預設: 3) */
  concurrency?: number;
  /** 重試次數限制 (預設: 3) */
  retryLimit?: number;
  /** 重試延遲基數 (毫秒, 預設: 1000) */
  retryDelay?: number;
  /** 檔案分塊大小 (bytes, 預設: 10MB) */
  chunkSize?: number;
  /** 進度回調函數 */
  onProgress?: ProgressCallback;
  /** 錯誤回調函數 */
  onError?: ErrorCallback;
  /** 完成回調函數 */
  onComplete?: CompleteCallback;
  /** 檔案開始傳輸回調 */
  onFileStart?: FileStartCallback;
  /** 檔案完成傳輸回調 */
  onFileComplete?: FileCompleteCallback;
}

/**
 * 傳輸會話
 */
export interface TransferSession {
  /** 會話 ID */
  id: string;
  /** 本地路徑 */
  localPath: string;
  /** 目標路徑 */
  destination: string;
  /** 會話狀態 */
  status: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  /** 總檔案數 */
  totalFiles: number;
  /** 已完成檔案數 */
  completedFiles: number;
  /** 失敗檔案數 */
  failedFiles: number;
  /** 跳過檔案數 */
  skippedFiles: number;
  /** 總大小 (bytes) */
  totalSize: number;
  /** 已傳輸大小 (bytes) */
  transferredSize: number;
  /** 開始時間 */
  startTime: Date;
  /** 結束時間 */
  endTime?: Date;
  /** 當前傳輸檔案 */
  currentFile?: string;
  /** 錯誤訊息 */
  error?: string;
  /** 傳輸選項 */
  options?: TransferOptions;
}

/**
 * 傳輸任務
 */
export interface TransferTask {
  /** 任務 ID */
  id: string;
  /** 檔案資訊 */
  file: LocalFile;
  /** MTP 檔案資訊 (如果存在) */
  mtpFile?: MTPFile;
  /** 目標路徑 */
  destination: string;
  /** 重試次數 */
  retries: number;
  /** 任務狀態 */
  status: TransferStatus;
  /** 錯誤資訊 */
  error?: Error;
  /** 開始時間 */
  startTime?: Date;
  /** 結束時間 */
  endTime?: Date;
  /** 已傳輸位元組數 */
  transferredBytes?: number;
  /** 優先級 (數字越小優先級越高) */
  priority?: number;
}

/**
 * 傳輸選項
 */
export interface TransferOptions {
  /** 會話 ID (用於續傳) */
  sessionId?: string;
  /** 檔案篩選選項 */
  filter?: FileScanOptions;
  /** 是否覆蓋已存在檔案 */
  overwrite?: boolean;
  /** 傳輸後驗證檔案 */
  verifyAfterTransfer?: boolean;
  /** 傳輸後刪除原檔案 */
  deleteAfterTransfer?: boolean;
  /** 保留檔案時間戳記 */
  preserveTimestamp?: boolean;
  /** 跳過錯誤繼續傳輸 */
  skipErrors?: boolean;
  /** 最大重試次數 (覆蓋預設) */
  maxRetries?: number;
  /** 傳輸模式 */
  mode?: 'copy' | 'move';
}

/**
 * 批次傳輸結果
 */
export interface BatchResult {
  /** 會話 ID */
  sessionId: string;
  /** 成功傳輸的檔案 */
  successful: TransferRecord[];
  /** 失敗的傳輸 */
  failed: FailedTransfer[];
  /** 跳過的檔案 */
  skipped: SkippedFile[];
  /** 傳輸統計 */
  stats: TransferStats;
}

/**
 * 失敗的傳輸
 */
export interface FailedTransfer {
  /** 檔案資訊 */
  file: LocalFile;
  /** 錯誤資訊 */
  error: Error;
  /** 重試次數 */
  attempts: number;
  /** 失敗時間 */
  failedAt: Date;
}

/**
 * 跳過的檔案
 */
export interface SkippedFile {
  /** 檔案資訊 */
  file: LocalFile;
  /** 跳過原因 */
  reason: 'exists' | 'filtered' | 'size_limit' | 'error' | 'user_cancelled';
  /** 詳細說明 */
  message?: string;
}

/**
 * 傳輸統計
 */
export interface TransferStats {
  /** 總檔案數 */
  totalFiles: number;
  /** 成功數量 */
  successCount: number;
  /** 失敗數量 */
  failureCount: number;
  /** 跳過數量 */
  skippedCount: number;
  /** 總大小 (bytes) */
  totalBytes: number;
  /** 傳輸大小 (bytes) */
  transferredBytes: number;
  /** 傳輸時間 (毫秒) */
  duration: number;
  /** 平均速度 (bytes/second) */
  averageSpeed: number;
  /** 開始時間 */
  startTime: Date;
  /** 結束時間 */
  endTime: Date;
}

/**
 * 傳輸結果
 */
export interface TransferResult {
  /** 是否成功 */
  success: boolean;
  /** 會話資訊 */
  session: TransferSession;
  /** 批次結果 */
  batch: BatchResult;
  /** 錯誤資訊 (如果失敗) */
  error?: Error | undefined;
}

/**
 * 進度資訊
 */
export interface TransferProgress {
  /** 當前檔案名稱 */
  currentFile: string;
  /** 當前檔案進度 (0-100) */
  currentFileProgress: number;
  /** 整體進度 (0-100) */
  overallProgress: number;
  /** 已完成檔案數 */
  filesCompleted: number;
  /** 總檔案數 */
  filesTotal: number;
  /** 已傳輸位元組數 */
  bytesTransferred: number;
  /** 總位元組數 */
  bytesTotal: number;
  /** 當前速度 (bytes/second) */
  currentSpeed?: number;
  /** 預估剩餘時間 (秒) */
  estimatedTimeRemaining?: number | undefined;
  /** 當前任務狀態 */
  status: 'preparing' | 'transferring' | 'verifying' | 'completing';
}

/**
 * 回調函數類型
 */
export type ProgressCallback = (progress: TransferProgress) => void;
export type ErrorCallback = (error: Error, file?: LocalFile) => void;
export type CompleteCallback = (result: TransferResult) => void;
export type FileStartCallback = (file: LocalFile) => void;
export type FileCompleteCallback = (file: LocalFile, success: boolean, error?: Error) => void;

/**
 * TransferManager 錯誤類型
 */
export type TransferErrorCode = 
  | 'NO_DEVICE'
  | 'DEVICE_DISCONNECTED'
  | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'SPACE_INSUFFICIENT'
  | 'TRANSFER_FAILED'
  | 'VERIFICATION_FAILED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'CANCELLED_BY_USER'
  | 'UNKNOWN_ERROR';

/**
 * TransferManager 錯誤資訊
 */
export interface TransferError extends Error {
  code: TransferErrorCode;
  file?: LocalFile;
  session?: string;
  details?: any;
}

/**
 * 傳輸佇列狀態
 */
export interface QueueStatus {
  /** 佇列中的任務數 */
  pending: number;
  /** 正在執行的任務數 */
  running: number;
  /** 已完成的任務數 */
  completed: number;
  /** 失敗的任務數 */
  failed: number;
  /** 是否暫停 */
  paused: boolean;
  /** 並行數 */
  concurrency: number;
}

/**
 * 預設 TransferManager 選項
 */
export const DEFAULT_TRANSFER_MANAGER_OPTIONS = {
  concurrency: 3,
  retryLimit: 3,
  retryDelay: 1000,
  chunkSize: 10 * 1024 * 1024 // 10MB
};

/**
 * 預設傳輸選項
 */
export const DEFAULT_TRANSFER_OPTIONS: Required<TransferOptions> = {
  sessionId: undefined as any,
  filter: undefined as any,
  overwrite: false,
  verifyAfterTransfer: true,
  deleteAfterTransfer: false,
  preserveTimestamp: true,
  skipErrors: false,
  maxRetries: 3,
  mode: 'copy'
};