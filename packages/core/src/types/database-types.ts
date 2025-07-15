/**
 * TypeScript type definitions for MTP Transfer Database
 */

export type TransferStatus = 'pending' | 'transferring' | 'completed' | 'failed' | 'skipped';

export interface TransferRecord {
  id: number;
  file_path: string;
  file_size: number;
  status: TransferStatus;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface NewTransferRecord {
  file_path: string;
  file_size: number;
  status?: TransferStatus;
}

export interface UpdateTransferRecord {
  status?: TransferStatus;
  error?: string;
}

export interface DatabaseOptions {
  readonly?: boolean;
  verbose?: boolean;
  filename?: string;
}

export interface TransferStats {
  total: number;
  pending: number;
  transferring: number;
  completed: number;
  failed: number;
  skipped: number;
}

export interface DatabaseInfo {
  filename: string;
  readonly: boolean;
  recordCount: number;
  lastUpdated?: string | undefined;
}