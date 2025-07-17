/**
 * @fileoverview File Differ Type Definitions
 * @description TypeScript types for file comparison functionality
 */

/**
 * File information from comparison
 */
export interface ComparisonFile {
  path: string;
  fileName: string;
  size: number;
  lastModified: Date;
  relativePath: string;
  isDirectory: boolean;
}

/**
 * File comparison statistics
 */
export interface FileComparisonStats {
  totalLocalFiles: number;
  totalMtpFiles: number;
  newFilesCount: number;
  modifiedFilesCount: number;
  duplicateFilesCount: number;
}

/**
 * File comparison result
 */
export interface FileComparisonResult {
  newFiles: ComparisonFile[];
  modifiedFiles: ComparisonFile[];
  duplicateFiles: ComparisonFile[];
  stats: FileComparisonStats;
}