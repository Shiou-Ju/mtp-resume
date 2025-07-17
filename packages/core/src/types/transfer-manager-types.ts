/**
 * @fileoverview Transfer Manager Type Definitions
 * @description TypeScript types for the transfer manager
 */

import type { TransferDatabase } from '../database';
import type { MTPWrapper } from '../mtp-wrapper';

/**
 * Transfer session status
 */
export type TransferSessionStatus = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Transfer task status
 */
export type TransferTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Transfer options for filtering files
 */
export interface TransferFilter {
  include?: string[];
  exclude?: string[];
}

/**
 * Transfer options
 */
export interface TransferOptions {
  sessionId?: string;
  filter?: TransferFilter;
  overwrite?: boolean;
  verifyAfterTransfer?: boolean;
  deleteAfterTransfer?: boolean;
  preserveTimestamp?: boolean;
  skipErrors?: boolean;
  maxRetries?: number;
  mode?: 'copy' | 'move';
}

/**
 * Transfer progress information
 */
export interface TransferProgress {
  currentFile: string;
  currentFileProgress: number;
  overallProgress: number;
  filesCompleted: number;
  filesTotal: number;
  bytesTransferred: number;
  bytesTotal: number;
  currentSpeed?: number;
  estimatedTimeRemaining?: number;
  status: 'transferring' | 'paused' | 'completed' | 'failed';
}

/**
 * File information for transfer
 */
export interface TransferFile {
  path: string;
  fileName: string;
  size: number;
  lastModified: Date;
  relativePath: string;
  isDirectory: boolean;
}

/**
 * Transfer task
 */
export interface TransferTask {
  id: string;
  file: TransferFile;
  destination: string;
  retries: number;
  status: TransferTaskStatus;
  priority: number;
  transferredBytes?: number;
  error?: Error;
}

/**
 * Transfer session
 */
export interface TransferSession {
  id: string;
  localPath: string;
  destination: string;
  status: TransferSessionStatus;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  totalSize: number;
  transferredSize: number;
  startTime: Date;
  endTime?: Date;
  options: TransferOptions;
  error?: string;
}

/**
 * Queue status
 */
export interface QueueStatus {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

/**
 * Transfer batch statistics
 */
export interface TransferBatchStats {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  totalBytes: number;
  transferredBytes: number;
  duration: number;
  averageSpeed: number;
  startTime: Date;
  endTime: Date;
}

/**
 * Transfer batch result
 */
export interface TransferBatch {
  sessionId: string;
  successful: any[];
  failed: any[];
  skipped: any[];
  stats: TransferBatchStats;
}

/**
 * Transfer result
 */
export interface TransferResult {
  success: boolean;
  session: TransferSession;
  batch: TransferBatch;
  error?: Error;
}

/**
 * Transfer manager configuration options
 */
export interface TransferManagerOptions {
  db: TransferDatabase;
  mtpWrapper?: MTPWrapper;
  concurrency?: number;
  retryLimit?: number;
  retryDelay?: number;
  chunkSize?: number;
  
  // Callbacks
  onProgress?: (progress: TransferProgress) => void;
  onError?: (error: Error, file?: TransferFile) => void;
  onComplete?: (result: TransferResult) => void;
  onFileStart?: (file: TransferFile) => void;
  onFileComplete?: (file: TransferFile, success: boolean, error?: Error) => void;
}

/**
 * Default transfer manager options
 */
export const DEFAULT_TRANSFER_MANAGER_OPTIONS = {
  concurrency: 3,
  retryLimit: 3,
  retryDelay: 1000,
  chunkSize: 1024 * 1024 // 1MB
};