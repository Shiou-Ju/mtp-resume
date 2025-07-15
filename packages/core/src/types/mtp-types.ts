/**
 * TypeScript type definitions for MTP (Media Transfer Protocol) operations
 */

export type MTPDeviceStatus = 'connected' | 'disconnected' | 'busy' | 'error';
export type MTPFileType = 'file' | 'folder';

export interface MTPDevice {
  vendor: string;
  model: string;
  serialNumber: string;
  deviceNumber?: number | undefined;
  connected: boolean;
  status: MTPDeviceStatus;
}

export interface MTPFile {
  id: number;
  parentId?: number;
  path: string;
  name: string;
  size: number;
  modifiedTime?: Date;
  type: MTPFileType;
  mimeType?: string;
}

export interface MTPWrapperOptions {
  timeout?: number;        // Command execution timeout in ms (default: 30000)
  retries?: number;        // Number of retry attempts (default: 3)
  debug?: boolean;         // Enable debug logging (default: false)
  mtpToolsPath?: string;   // Custom path to MTP tools (optional)
}

export interface MTPCommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
}

export interface MTPTransferProgress {
  fileId: number;
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
}

export interface MTPDeviceInfo {
  device: MTPDevice;
  storageInfo?: MTPStorageInfo[];
  supportedFormats?: string[];
  batteryLevel?: number;
}

export interface MTPStorageInfo {
  id: number;
  description: string;
  volumeLabel: string;
  totalSpace: number;
  freeSpace: number;
  usedSpace: number;
}

export interface MTPListOptions {
  recursive?: boolean;
  includeMetadata?: boolean;
  filter?: {
    fileTypes?: string[];
    minSize?: number;
    maxSize?: number;
    modifiedAfter?: Date;
    modifiedBefore?: Date;
  };
}

export interface MTPDownloadOptions {
  destination: string;
  overwrite?: boolean;
  createDirectories?: boolean;
  preserveTimestamps?: boolean;
  onProgress?: (progress: MTPTransferProgress) => void;
}

export interface MTPError extends Error {
  code: MTPErrorCode;
  command?: string;
  deviceInfo?: Partial<MTPDevice>;
}

export enum MTPErrorCode {
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  DEVICE_BUSY = 'DEVICE_BUSY',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  TRANSFER_FAILED = 'TRANSFER_FAILED',
  COMMAND_TIMEOUT = 'COMMAND_TIMEOUT',
  COMMAND_FAILED = 'COMMAND_FAILED',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface MTPCommandOptions {
  timeout?: number;
  retries?: number;
  args?: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
}

// Mock data interfaces for testing
export interface MockMTPDevice extends MTPDevice {
  mockFiles?: MockMTPFile[];
  mockCommands?: Record<string, string>;
}

export interface MockMTPFile extends MTPFile {
  content?: string;
  downloadDelay?: number;
}

export interface MockMTPEnvironment {
  devices: MockMTPDevice[];
  simulateErrors?: boolean;
  commandDelay?: number;
}