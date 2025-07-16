/**
 * @fileoverview FileDiffer Type Definitions
 * @description TypeScript interfaces for file comparison and difference analysis
 */

/**
 * 本地檔案資訊
 */
export interface LocalFile {
  /** 完整檔案路徑 */
  path: string;
  /** 檔案大小 (bytes) */
  size: number;
  /** 檔案修改時間 */
  modifiedTime: Date;
  /** 相對路徑 (相對於掃描根目錄) */
  relativePath: string;
  /** 檔案副檔名 (包含點號，如 .jpg) */
  extension: string;
  /** 檔案名稱 (不含路徑) */
  fileName: string;
}

/**
 * 檔案比對結果
 */
export interface FileComparisonResult {
  /** 新檔案 (本地有，MTP 裝置沒有) */
  newFiles: LocalFile[];
  /** 修改檔案 (大小或時間不同) */
  modifiedFiles: LocalFile[];
  /** 重複檔案 (完全相同) */
  duplicateFiles: LocalFile[];
  /** 總檔案數量 */
  totalFiles: number;
  /** 總檔案大小 (bytes) */
  totalSize: number;
  /** 需要傳輸的檔案數量 */
  transferCount: number;
  /** 需要傳輸的總大小 (bytes) */
  transferSize: number;
}

/**
 * 檔案掃描選項
 */
export interface FileScanOptions {
  /** 是否遞迴掃描子目錄 */
  recursive?: boolean;
  /** 包含的檔案模式 (glob patterns) */
  includePatterns?: string[];
  /** 排除的檔案模式 (glob patterns) */
  excludePatterns?: string[];
  /** 最大檔案大小 (bytes) */
  maxFileSize?: number;
  /** 最小檔案大小 (bytes) */
  minFileSize?: number;
  /** 最大檔案數量 */
  maxFiles?: number;
  /** 是否跟隨符號連結 */
  followSymlinks?: boolean;
}

/**
 * FileDiffer 配置選項
 */
export interface FileDifferOptions {
  /** 檔案大小容忍度 (bytes) */
  sizeTolerance?: number;
  /** 時間比對容忍度 (milliseconds) */
  timeTolerance?: number;
  /** 是否忽略時間比對 */
  ignoreTime?: boolean;
  /** 是否忽略大小寫 */
  ignoreCase?: boolean;
  /** 並行處理數量 */
  concurrency?: number;
  /** 記憶體使用限制 (bytes) */
  memoryLimit?: number;
}

/**
 * 檔案篩選結果
 */
export interface FileFilterResult {
  /** 符合條件的檔案 */
  matched: LocalFile[];
  /** 被排除的檔案 */
  excluded: LocalFile[];
  /** 篩選統計 */
  stats: {
    totalFiles: number;
    matchedFiles: number;
    excludedFiles: number;
    totalSize: number;
    matchedSize: number;
  };
}

/**
 * 路徑標準化選項
 */
export interface PathNormalizationOptions {
  /** 是否使用正斜線 */
  useForwardSlash?: boolean;
  /** 是否轉換為小寫 */
  toLowerCase?: boolean;
  /** 路徑分隔符 */
  separator?: string;
  /** 根路徑前綴 */
  rootPrefix?: string;
}

/**
 * 檔案比對統計
 */
export interface ComparisonStats {
  /** 掃描時間 (milliseconds) */
  scanTime: number;
  /** 比對時間 (milliseconds) */
  compareTime: number;
  /** 總處理時間 (milliseconds) */
  totalTime: number;
  /** 記憶體使用峰值 (bytes) */
  peakMemory: number;
  /** 本地檔案數量 */
  localFileCount: number;
  /** MTP 檔案數量 */
  mtpFileCount: number;
}

/**
 * FileDiffer 錯誤類型
 */
export type FileDifferErrorCode = 
  | 'INVALID_PATH'
  | 'PERMISSION_DENIED' 
  | 'FILE_NOT_FOUND'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'SCAN_TIMEOUT'
  | 'PATTERN_INVALID'
  | 'SIZE_LIMIT_EXCEEDED'
  | 'UNKNOWN_ERROR';

/**
 * FileDiffer 錯誤資訊
 */
export interface FileDifferError extends Error {
  code: FileDifferErrorCode;
  path?: string;
  details?: any;
}

/**
 * 進度回調函數類型
 */
export type ProgressCallback = (current: number, total: number, message?: string) => void;

/**
 * 檔案掃描進度資訊
 */
export interface ScanProgress {
  /** 已掃描檔案數量 */
  scannedFiles: number;
  /** 已掃描目錄數量 */
  scannedDirectories: number;
  /** 當前掃描路徑 */
  currentPath: string;
  /** 掃描開始時間 */
  startTime: Date;
  /** 預估剩餘時間 (milliseconds) */
  estimatedTimeRemaining?: number;
}

/**
 * 支援的檔案格式定義
 */
export const SUPPORTED_FILE_FORMATS = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'],
  videos: ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v'],
  documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xlsx', '.pptx'],
  audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
  archives: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2']
};

// 所有支援的格式
export const ALL_SUPPORTED_FORMATS = [
  ...SUPPORTED_FILE_FORMATS.images,
  ...SUPPORTED_FILE_FORMATS.videos,
  ...SUPPORTED_FILE_FORMATS.documents,
  ...SUPPORTED_FILE_FORMATS.audio,
  ...SUPPORTED_FILE_FORMATS.archives
];

/**
 * 預設排除模式
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/.DS_Store',
  '**/Thumbs.db',
  '**/.git/**',
  '**/node_modules/**',
  '**/*.tmp',
  '**/*.temp',
  '**/.cache/**',
  '**/System Volume Information/**'
];

/**
 * 預設 FileDiffer 選項
 */
export const DEFAULT_FILE_DIFFER_OPTIONS: Required<FileDifferOptions> = {
  sizeTolerance: 0,
  timeTolerance: 1000, // 1 second
  ignoreTime: false,
  ignoreCase: false,
  concurrency: 10,
  memoryLimit: 512 * 1024 * 1024 // 512 MB
};

/**
 * 預設檔案掃描選項
 */
export const DEFAULT_FILE_SCAN_OPTIONS: Required<FileScanOptions> = {
  recursive: true,
  includePatterns: ['**/*'],
  excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
  maxFileSize: 50 * 1024 * 1024 * 1024, // 50 GB
  minFileSize: 0,
  maxFiles: 100000,
  followSymlinks: false
};