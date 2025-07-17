/**
 * @fileoverview FileDiffer - File Comparison and Difference Analysis
 * @description Compares local files with MTP device files to identify differences
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { minimatch } from 'minimatch';
import type { MTPFile } from './types/mtp-types';
import type {
  LocalFile,
  FileComparisonResult,
  FileScanOptions,
  FileDifferOptions,
  FileFilterResult,
  ComparisonStats,
  FileDifferError,
  FileDifferErrorCode,
  ProgressCallback,
  ScanProgress
} from './types/file-differ-types';

import {
  DEFAULT_FILE_DIFFER_OPTIONS,
  DEFAULT_FILE_SCAN_OPTIONS,
  DEFAULT_EXCLUDE_PATTERNS
} from './types/file-differ-types';

/**
 * FileDiffer 主類別
 * 負責檔案比對、差異分析和檔案篩選
 */
export class FileDiffer {
  private options: Required<FileDifferOptions>;
  private stats: ComparisonStats;
  private progressCallback?: ProgressCallback;

  constructor(options: FileDifferOptions = {}) {
    this.options = { ...DEFAULT_FILE_DIFFER_OPTIONS, ...options };
    this.stats = this.initializeStats();
  }

  /**
   * 設定進度回調函數
   */
  public setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * 掃描本地目錄獲取檔案清單
   */
  public async scanLocalDirectory(
    directoryPath: string,
    options: FileScanOptions = {}
  ): Promise<LocalFile[]> {
    const scanOptions = { ...DEFAULT_FILE_SCAN_OPTIONS, ...options };
    const startTime = Date.now();
    
    try {
      // 驗證目錄路徑
      await this.validatePath(directoryPath);
      
      const files: LocalFile[] = [];
      const scanProgress: ScanProgress = {
        scannedFiles: 0,
        scannedDirectories: 0,
        currentPath: directoryPath,
        startTime: new Date()
      };

      await this.scanDirectoryRecursive(
        directoryPath,
        directoryPath,
        files,
        scanOptions,
        scanProgress
      );

      this.stats.scanTime = Date.now() - startTime;
      this.stats.localFileCount = files.length;

      return files;
    } catch (error) {
      throw this.createError('SCAN_TIMEOUT', `Failed to scan directory: ${directoryPath}`, error);
    }
  }

  /**
   * 比較本地目錄與 MTP 檔案
   */
  public async compareDirectories(
    localPath: string,
    mtpFiles: MTPFile[],
    options: FileScanOptions = {}
  ): Promise<FileComparisonResult> {
    const startTime = Date.now();
    
    try {
      // 掃描本地檔案
      const localFiles = await this.scanLocalDirectory(localPath, options);
      
      // 開始比對
      const compareStart = Date.now();
      
      // 標準化 MTP 檔案路徑
      const normalizedMtpFiles = this.normalizeMtpFiles(mtpFiles);
      
      // 執行分類比對
      const newFiles = await this.getNewFiles(localFiles, normalizedMtpFiles);
      const modifiedFiles = await this.getModifiedFiles(localFiles, normalizedMtpFiles);
      const duplicateFiles = await this.getDuplicateFiles(localFiles, normalizedMtpFiles);
      
      this.stats.compareTime = Date.now() - compareStart;
      this.stats.totalTime = Date.now() - startTime;
      this.stats.mtpFileCount = mtpFiles.length;
      
      // 計算統計資訊
      const transferFiles = [...newFiles, ...modifiedFiles];
      const transferSize = transferFiles.reduce((sum, file) => sum + file.size, 0);
      const totalSize = localFiles.reduce((sum, file) => sum + file.size, 0);
      
      return {
        newFiles,
        modifiedFiles,
        duplicateFiles,
        totalFiles: localFiles.length,
        totalSize,
        transferCount: transferFiles.length,
        transferSize
      };
    } catch (error) {
      throw this.createError('UNKNOWN_ERROR', 'Failed to compare directories', error);
    }
  }

  /**
   * 取得新檔案 (本地有，MTP 沒有)
   */
  public async getNewFiles(localFiles: LocalFile[], mtpFiles: MTPFile[]): Promise<LocalFile[]> {
    const mtpFileMap = this.createMtpFileMap(mtpFiles);
    
    return localFiles.filter(localFile => {
      const key = this.createFileKey(localFile.relativePath, localFile.size);
      return !mtpFileMap.has(key);
    });
  }

  /**
   * 取得修改檔案 (大小或時間不同)
   */
  public async getModifiedFiles(localFiles: LocalFile[], mtpFiles: MTPFile[]): Promise<LocalFile[]> {
    const mtpFileMap = this.createMtpFileMap(mtpFiles);
    
    return localFiles.filter(localFile => {
      const key = this.createFileKey(localFile.relativePath, localFile.size);
      const mtpFile = mtpFileMap.get(key);
      
      if (!mtpFile) return false;
      
      // 檢查大小差異
      const sizeDiff = Math.abs(localFile.size - mtpFile.size);
      if (sizeDiff > this.options.sizeTolerance) {
        return true;
      }
      
      // 檢查時間差異 (如果不忽略時間)
      if (!this.options.ignoreTime && mtpFile.modifiedTime) {
        const timeDiff = Math.abs(localFile.modifiedTime.getTime() - mtpFile.modifiedTime.getTime());
        if (timeDiff > this.options.timeTolerance) {
          return true;
        }
      }
      
      return false;
    });
  }

  /**
   * 取得重複檔案 (完全相同)
   */
  public async getDuplicateFiles(localFiles: LocalFile[], mtpFiles: MTPFile[]): Promise<LocalFile[]> {
    const mtpFileMap = this.createMtpFileMap(mtpFiles);
    
    return localFiles.filter(localFile => {
      const key = this.createFileKey(localFile.relativePath, localFile.size);
      const mtpFile = mtpFileMap.get(key);
      
      if (!mtpFile) return false;
      
      // 檢查大小是否在容忍範圍內
      const sizeDiff = Math.abs(localFile.size - mtpFile.size);
      if (sizeDiff > this.options.sizeTolerance) {
        return false;
      }
      
      // 檢查時間是否在容忍範圍內 (如果不忽略時間)
      if (!this.options.ignoreTime && mtpFile.modifiedTime) {
        const timeDiff = Math.abs(localFile.modifiedTime.getTime() - mtpFile.modifiedTime.getTime());
        if (timeDiff > this.options.timeTolerance) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * 篩選檔案
   */
  public async filterFiles(
    files: LocalFile[],
    includePatterns: string[] = ['**/*'],
    excludePatterns: string[] = DEFAULT_EXCLUDE_PATTERNS
  ): Promise<FileFilterResult> {
    const matched: LocalFile[] = [];
    const excluded: LocalFile[] = [];
    
    for (const file of files) {
      const relativePath = file.relativePath;
      
      // 檢查排除模式
      const isExcluded = excludePatterns.some(pattern => 
        minimatch(relativePath, pattern, { matchBase: true })
      );
      
      if (isExcluded) {
        excluded.push(file);
        continue;
      }
      
      // 檢查包含模式
      const isIncluded = includePatterns.some(pattern => 
        minimatch(relativePath, pattern, { matchBase: true })
      );
      
      if (isIncluded) {
        matched.push(file);
      } else {
        excluded.push(file);
      }
    }
    
    return {
      matched,
      excluded,
      stats: {
        totalFiles: files.length,
        matchedFiles: matched.length,
        excludedFiles: excluded.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
        matchedSize: matched.reduce((sum, file) => sum + file.size, 0)
      }
    };
  }

  /**
   * 排除檔案
   */
  public async excludeFiles(
    files: LocalFile[],
    excludePatterns: string[]
  ): Promise<LocalFile[]> {
    return files.filter(file => {
      const relativePath = file.relativePath;
      return !excludePatterns.some(pattern => 
        minimatch(relativePath, pattern, { matchBase: true })
      );
    });
  }

  /**
   * 取得比對統計資訊
   */
  public getStats(): ComparisonStats {
    return { ...this.stats };
  }

  /**
   * 重置統計資訊
   */
  public resetStats(): void {
    this.stats = this.initializeStats();
  }

  // Private methods

  /**
   * 遞迴掃描目錄
   */
  private async scanDirectoryRecursive(
    currentPath: string,
    rootPath: string,
    files: LocalFile[],
    options: Required<FileScanOptions>,
    progress: ScanProgress
  ): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      progress.scannedDirectories++;
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);
        
        // 更新進度
        progress.currentPath = fullPath;
        this.progressCallback?.(progress.scannedFiles, progress.scannedFiles + 1, relativePath);
        
        // 檢查檔案數量限制
        if (files.length >= options.maxFiles) {
          break;
        }
        
        if (entry.isDirectory()) {
          // 遞迴掃描子目錄
          if (options.recursive) {
            await this.scanDirectoryRecursive(fullPath, rootPath, files, options, progress);
          }
        } else if (entry.isFile() || (entry.isSymbolicLink() && options.followSymlinks)) {
          // 處理檔案
          const stats = await fs.stat(fullPath);
          
          // 檢查檔案大小限制
          if (stats.size < options.minFileSize || stats.size > options.maxFileSize) {
            continue;
          }
          
          const localFile: LocalFile = {
            path: fullPath,
            size: stats.size,
            modifiedTime: stats.mtime,
            relativePath: this.normalizePath(relativePath),
            extension: path.extname(entry.name).toLowerCase(),
            fileName: entry.name
          };
          
          files.push(localFile);
          progress.scannedFiles++;
        }
      }
    } catch (error) {
      // 忽略權限錯誤，繼續掃描其他目錄
      if ((error as any).code !== 'EACCES') {
        throw error;
      }
    }
  }

  /**
   * 驗證路徑
   */
  private async validatePath(directoryPath: string): Promise<void> {
    try {
      const stats = await fs.stat(directoryPath);
      if (!stats.isDirectory()) {
        throw this.createError('INVALID_PATH', `Path is not a directory: ${directoryPath}`);
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw this.createError('FILE_NOT_FOUND', `Directory not found: ${directoryPath}`);
      }
      if ((error as any).code === 'EACCES') {
        throw this.createError('PERMISSION_DENIED', `Permission denied: ${directoryPath}`);
      }
      throw error;
    }
  }

  /**
   * 標準化路徑
   */
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * 標準化 MTP 檔案
   */
  private normalizeMtpFiles(mtpFiles: MTPFile[]): MTPFile[] {
    return mtpFiles.map(file => ({
      ...file,
      path: this.normalizePath(file.path)
    }));
  }

  /**
   * 建立 MTP 檔案映射
   */
  private createMtpFileMap(mtpFiles: MTPFile[]): Map<string, MTPFile> {
    const map = new Map<string, MTPFile>();
    
    for (const file of mtpFiles) {
      const key = this.createFileKey(file.path, file.size);
      map.set(key, file);
    }
    
    return map;
  }

  /**
   * 建立檔案鍵值
   */
  private createFileKey(path: string, size: number): string {
    // 提取檔案名稱進行比對，而不是完整路徑
    const fileName = path.split('/').pop() || path;
    const normalizedFileName = this.options.ignoreCase ? fileName.toLowerCase() : fileName;
    return `${normalizedFileName}:${size}`;
  }

  /**
   * 初始化統計資訊
   */
  private initializeStats(): ComparisonStats {
    return {
      scanTime: 0,
      compareTime: 0,
      totalTime: 0,
      peakMemory: 0,
      localFileCount: 0,
      mtpFileCount: 0
    };
  }

  /**
   * 建立錯誤物件
   */
  private createError(code: FileDifferErrorCode, message: string, originalError?: any): FileDifferError {
    const error = new Error(message) as FileDifferError;
    error.code = code;
    error.details = originalError;
    return error;
  }
}