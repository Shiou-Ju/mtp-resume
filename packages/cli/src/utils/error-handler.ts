/**
 * @fileoverview Centralized Error Handler
 * @description Unified error handling system for consistent error management
 */

import chalk from 'chalk';
import { ExitCode } from './exit-codes';
import type { Logger } from '../types/cli-types';

/**
 * Error types for better classification
 */
export enum ErrorType {
  MTP_DEVICE = 'MTP_DEVICE',
  FILE_SYSTEM = 'FILE_SYSTEM',
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  VALIDATION = 'VALIDATION',
  SYSTEM = 'SYSTEM',
  USER_INPUT = 'USER_INPUT',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',        // Warning, can continue
  MEDIUM = 'medium',  // Error, but recoverable
  HIGH = 'high',      // Critical error, should exit
  FATAL = 'fatal'     // System failure, immediate exit
}

/**
 * Structured error information
 */
export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  code: ExitCode;
  message: string;
  userMessage: string;
  suggestions: string[];
  canRetry: boolean;
  technicalDetails?: string;
  relatedCommand?: string;
}

/**
 * Error patterns for classification
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  type: ErrorType;
  severity: ErrorSeverity;
  code: ExitCode;
  userMessage: string;
  suggestions: string[];
  canRetry: boolean;
}> = [
  // MTP Device Errors
  {
    pattern: /no mtp device|no raw devices found|device not found/i,
    type: ErrorType.MTP_DEVICE,
    severity: ErrorSeverity.HIGH,
    code: ExitCode.NO_DEVICE,
    userMessage: '未找到 MTP 裝置',
    suggestions: [
      '確認裝置已透過 USB 連接',
      '確認裝置已解鎖',
      '選擇「檔案傳輸」或「MTP」模式',
      '嘗試重新連接 USB 纜線',
      '檢查 USB 纜線是否支援資料傳輸'
    ],
    canRetry: true
  },
  {
    pattern: /device is busy|resource busy|device busy/i,
    type: ErrorType.MTP_DEVICE,
    severity: ErrorSeverity.MEDIUM,
    code: ExitCode.DEVICE_BUSY,
    userMessage: '裝置忙碌中',
    suggestions: [
      '等待片刻後重試',
      '關閉其他使用 MTP 的應用程式',
      '重新連接裝置',
      '重啟裝置的 MTP 服務'
    ],
    canRetry: true
  },
  {
    pattern: /permission denied|access denied/i,
    type: ErrorType.MTP_DEVICE,
    severity: ErrorSeverity.HIGH,
    code: ExitCode.PERMISSION_DENIED,
    userMessage: '權限不足',
    suggestions: [
      '在裝置上允許檔案傳輸',
      '確認裝置已解鎖',
      '檢查裝置的開發者選項設定',
      '嘗試使用管理員權限執行'
    ],
    canRetry: true
  },
  
  // File System Errors
  {
    pattern: /no such file|file not found|path not found/i,
    type: ErrorType.FILE_SYSTEM,
    severity: ErrorSeverity.HIGH,
    code: ExitCode.FILE_NOT_FOUND,
    userMessage: '檔案或路徑不存在',
    suggestions: [
      '檢查檔案路徑是否正確',
      '確認檔案未被移動或刪除',
      '使用絕對路徑'
    ],
    canRetry: false
  },
  {
    pattern: /enospc|no space left|disk full|storage full/i,
    type: ErrorType.FILE_SYSTEM,
    severity: ErrorSeverity.HIGH,
    code: ExitCode.TRANSFER_FAILED,
    userMessage: '儲存空間不足',
    suggestions: [
      '清理裝置儲存空間',
      '刪除不需要的檔案',
      '檢查可用空間大小',
      '選擇較小的檔案進行傳輸'
    ],
    canRetry: true
  },
  {
    pattern: /eacces|permission denied.*file/i,
    type: ErrorType.FILE_SYSTEM,
    severity: ErrorSeverity.MEDIUM,
    code: ExitCode.PERMISSION_DENIED,
    userMessage: '檔案權限不足',
    suggestions: [
      '檢查檔案權限設定',
      '確認有寫入權限',
      '嘗試使用管理員權限'
    ],
    canRetry: true
  },
  
  // Network/Connection Errors  
  {
    pattern: /timeout|connection timeout/i,
    type: ErrorType.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    code: ExitCode.TIMEOUT,
    userMessage: '連線逾時',
    suggestions: [
      '檢查 USB 連線狀態',
      '降低並行傳輸數量',
      '重新連接裝置',
      '增加逾時時間設定'
    ],
    canRetry: true
  },
  
  // Database Errors
  {
    pattern: /database|sqlite.*error|db.*error/i,
    type: ErrorType.DATABASE,
    severity: ErrorSeverity.MEDIUM,
    code: ExitCode.DATABASE_ERROR,
    userMessage: '資料庫錯誤',
    suggestions: [
      '檢查資料庫檔案權限',
      '確認磁碟空間充足',
      '嘗試刪除損壞的資料庫檔案',
      '使用 --db 參數指定新的資料庫位置'
    ],
    canRetry: true
  },
  
  // Validation Errors
  {
    pattern: /invalid argument|missing required argument|invalid option/i,
    type: ErrorType.VALIDATION,
    severity: ErrorSeverity.LOW,
    code: ExitCode.INVALID_ARGUMENT,
    userMessage: '命令參數錯誤',
    suggestions: [
      '檢查命令語法',
      '使用 --help 查看正確用法',
      '確認所有必要參數都已提供'
    ],
    canRetry: false
  },
  
  // System Errors
  {
    pattern: /command not found.*mtp|mtp.*not installed/i,
    type: ErrorType.SYSTEM,
    severity: ErrorSeverity.FATAL,
    code: ExitCode.COMMAND_NOT_FOUND,
    userMessage: 'MTP 工具未安裝',
    suggestions: [
      '安裝 libmtp 開發套件',
      'Ubuntu/Debian: sudo apt install libmtp-dev',
      'macOS: brew install libmtp',
      'CentOS/RHEL: sudo yum install libmtp-devel'
    ],
    canRetry: false
  }
];

/**
 * Centralized error handler
 */
export class ErrorHandler {
  private logger: Logger;
  private useColor: boolean;
  private verbose: boolean;

  constructor(logger: Logger, options: { useColor?: boolean; verbose?: boolean } = {}) {
    this.logger = logger;
    this.useColor = options.useColor ?? true;
    this.verbose = options.verbose ?? false;
  }

  /**
   * Handle error and determine exit strategy
   */
  handle(error: Error | string, context?: { command?: string; operation?: string }): never {
    const errorInfo = this.classifyError(error, context);
    
    // Log the error
    this.logError(errorInfo);
    
    // Show user-friendly message
    this.showUserMessage(errorInfo);
    
    // Exit with appropriate code
    process.exit(errorInfo.code);
  }

  /**
   * Classify error into structured information
   */
  classifyError(error: Error | string, context?: { command?: string; operation?: string }): ErrorInfo {
    const errorMessage = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;
    
    // Find matching pattern
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.pattern.test(errorMessage)) {
        const result: ErrorInfo = {
          type: pattern.type,
          severity: pattern.severity,
          code: pattern.code,
          message: errorMessage,
          userMessage: pattern.userMessage,
          suggestions: pattern.suggestions,
          canRetry: pattern.canRetry
        };
        
        if (this.verbose && stack) {
          result.technicalDetails = stack;
        }
        
        if (context?.command) {
          result.relatedCommand = context.command;
        }
        
        return result;
      }
    }
    
    // Default unknown error
    const result: ErrorInfo = {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      code: ExitCode.GENERAL_ERROR,
      message: errorMessage,
      userMessage: '發生未知錯誤',
      suggestions: [
        '檢查命令語法是否正確',
        '確認系統環境配置',
        '查看詳細錯誤日誌',
        '聯絡技術支援'
      ],
      canRetry: false
    };
    
    if (this.verbose && stack) {
      result.technicalDetails = stack;
    }
    
    if (context?.command) {
      result.relatedCommand = context.command;
    }
    
    return result;
  }

  /**
   * Log error details
   */
  private logError(errorInfo: ErrorInfo): void {
    if (this.verbose) {
      this.logger.error(`[${errorInfo.type}:${errorInfo.severity}] ${errorInfo.message}`);
      
      if (errorInfo.technicalDetails) {
        console.error(chalk.dim('\n技術細節:'));
        console.error(chalk.dim(errorInfo.technicalDetails));
      }
    }
  }

  /**
   * Show user-friendly error message
   */
  private showUserMessage(errorInfo: ErrorInfo): void {
    const icon = this.getSeverityIcon(errorInfo.severity);
    const color = this.getSeverityColor(errorInfo.severity);
    
    console.error(''); // Empty line
    
    if (this.useColor) {
      console.error(color(`${icon} ${errorInfo.userMessage}`));
    } else {
      console.error(`${icon} ${errorInfo.userMessage}`);
    }
    
    // Show suggestions
    if (errorInfo.suggestions.length > 0) {
      console.error('\n💡 建議解決方案:');
      errorInfo.suggestions.forEach((suggestion, index) => {
        const prefix = this.useColor ? chalk.dim(`  ${index + 1}.`) : `  ${index + 1}.`;
        console.error(`${prefix} ${suggestion}`);
      });
    }
    
    // Show retry information
    if (errorInfo.canRetry) {
      const retryMsg = '🔄 此錯誤可能是暫時性的，請稍後重試';
      console.error(this.useColor ? chalk.yellow(`\n${retryMsg}`) : `\n${retryMsg}`);
    }
    
    // Show command help
    if (errorInfo.relatedCommand) {
      const helpMsg = `📖 使用 'mtp-transfer ${errorInfo.relatedCommand} --help' 查看詳細說明`;
      console.error(this.useColor ? chalk.blue(`\n${helpMsg}`) : `\n${helpMsg}`);
    }
    
    console.error(''); // Empty line
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.LOW: return '⚠️';
      case ErrorSeverity.MEDIUM: return '❌';
      case ErrorSeverity.HIGH: return '🚨';
      case ErrorSeverity.FATAL: return '💀';
      default: return '❓';
    }
  }

  /**
   * Get severity color function
   */
  private getSeverityColor(severity: ErrorSeverity): (text: string) => string {
    if (!this.useColor) {
      return (text: string) => text;
    }
    
    switch (severity) {
      case ErrorSeverity.LOW: return chalk.yellow;
      case ErrorSeverity.MEDIUM: return chalk.red;
      case ErrorSeverity.HIGH: return chalk.redBright;
      case ErrorSeverity.FATAL: return chalk.red.bold;
      default: return chalk.red;
    }
  }

  /**
   * Check if error can be retried
   */
  static canRetry(error: Error | string): boolean {
    const handler = new ErrorHandler(console as any); // Minimal logger for classification
    const errorInfo = handler.classifyError(error);
    return errorInfo.canRetry;
  }

  /**
   * Get exit code for error
   */
  static getExitCode(error: Error | string): ExitCode {
    const handler = new ErrorHandler(console as any); // Minimal logger for classification
    const errorInfo = handler.classifyError(error);
    return errorInfo.code;
  }

  /**
   * Get user-friendly message for error
   */
  static getUserMessage(error: Error | string): string {
    const handler = new ErrorHandler(console as any); // Minimal logger for classification
    const errorInfo = handler.classifyError(error);
    return errorInfo.userMessage;
  }
}

/**
 * Create error handler instance
 */
export function createErrorHandler(logger: Logger, options?: { useColor?: boolean; verbose?: boolean }): ErrorHandler {
  return new ErrorHandler(logger, options);
}

/**
 * Quick error handling function for immediate use
 */
export function handleError(error: Error | string, logger: Logger, context?: { command?: string; operation?: string }): never {
  const handler = createErrorHandler(logger, { useColor: !process.env.NO_COLOR, verbose: process.argv.includes('--verbose') });
  return handler.handle(error, context);
}