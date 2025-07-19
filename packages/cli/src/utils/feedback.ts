/**
 * @fileoverview User Feedback System
 * @description Comprehensive feedback utilities for better UX
 */

import chalk from 'chalk';
import { EnhancedProgressDisplay } from './enhanced-progress';
import { AnimatedStatus, SuccessAnimation, StatusMessage } from './animations';
import type { Logger } from '../types/cli-types';

/**
 * Feedback system configuration
 */
export interface FeedbackConfig {
  /** Enable colors */
  useColor?: boolean;
  /** Enable animations */
  useAnimations?: boolean;
  /** Verbose mode */
  verbose?: boolean;
  /** Silent mode (minimal output) */
  silent?: boolean;
  /** Custom logger */
  logger?: Logger;
}

/**
 * Transfer stage types
 */
export type TransferStage = 
  | 'detecting'
  | 'connecting'
  | 'scanning'
  | 'comparing'
  | 'transferring'
  | 'verifying'
  | 'completing';

/**
 * Stage messages
 */
const STAGE_MESSAGES: Record<TransferStage, { start: string; success: string; error: string }> = {
  detecting: {
    start: '偵測 MTP 裝置中...',
    success: '成功偵測到裝置',
    error: '無法偵測到 MTP 裝置'
  },
  connecting: {
    start: '連接裝置中...',
    success: '裝置連接成功',
    error: '裝置連接失敗'
  },
  scanning: {
    start: '掃描檔案中...',
    success: '檔案掃描完成',
    error: '檔案掃描失敗'
  },
  comparing: {
    start: '比對檔案差異中...',
    success: '檔案比對完成',
    error: '檔案比對失敗'
  },
  transferring: {
    start: '傳輸檔案中...',
    success: '檔案傳輸完成',
    error: '檔案傳輸失敗'
  },
  verifying: {
    start: '驗證檔案完整性...',
    success: '檔案驗證成功',
    error: '檔案驗證失敗'
  },
  completing: {
    start: '完成最後處理...',
    success: '所有操作完成',
    error: '操作未完全成功'
  }
};

/**
 * Comprehensive user feedback system
 */
export class UserFeedback {
  private config: Required<FeedbackConfig>;
  private progressDisplay?: EnhancedProgressDisplay;
  private currentStage?: TransferStage;
  private stageAnimation?: AnimatedStatus;
  private startTime: number;
  
  constructor(config: FeedbackConfig = {}) {
    this.config = {
      useColor: config.useColor ?? true,
      useAnimations: config.useAnimations ?? true,
      verbose: config.verbose ?? false,
      silent: config.silent ?? false,
      logger: config.logger ?? this.createDefaultLogger()
    };
    
    this.startTime = Date.now();
  }
  
  /**
   * Start a new stage
   */
  public startStage(stage: TransferStage): void {
    if (this.silent) return;
    
    // Stop previous stage animation
    this.stopStageAnimation();
    
    this.currentStage = stage;
    const message = STAGE_MESSAGES[stage].start;
    
    if (this.config.useAnimations) {
      this.stageAnimation = new AnimatedStatus({
        text: message,
        type: 'dots',
        color: 'blue'
      }).start();
    } else {
      this.config.logger.info(message);
    }
  }
  
  /**
   * Complete current stage
   */
  public completeStage(success: boolean = true, customMessage?: string): void {
    if (this.silent || !this.currentStage) return;
    
    const stage = this.currentStage;
    const message = customMessage || (success ? STAGE_MESSAGES[stage].success : STAGE_MESSAGES[stage].error);
    
    if (this.stageAnimation) {
      if (success) {
        this.stageAnimation.succeed(message);
      } else {
        this.stageAnimation.fail(message);
      }
      this.stageAnimation = undefined as any;
    } else {
      if (success) {
        this.config.logger.success(message);
      } else {
        this.config.logger.error(message);
      }
    }
    
    this.currentStage = undefined as any;
  }
  
  /**
   * Update stage progress
   */
  public updateStage(message: string, count?: number): void {
    if (this.silent) return;
    
    if (this.stageAnimation) {
      if (count !== undefined) {
        this.stageAnimation.updateWithCount(message, count, '');
      } else {
        this.stageAnimation.update(message);
      }
    } else if (this.config.verbose) {
      this.config.logger.info(`${message}${count !== undefined ? ` (${count})` : ''}`);
    }
  }
  
  /**
   * Show device info
   */
  public showDeviceInfo(info: {
    vendor: string;
    model: string;
    serialNumber: string;
    storage?: Array<{ description: string; freeSpace: string; totalSpace: string }>;
  }): void {
    if (this.silent) return;
    
    console.log('');
    console.log(chalk.bold('📱 裝置資訊:'));
    console.log(`  廠商: ${chalk.cyan(info.vendor)}`);
    console.log(`  型號: ${chalk.cyan(info.model)}`);
    console.log(`  序號: ${chalk.dim(info.serialNumber)}`);
    
    if (info.storage && info.storage.length > 0) {
      console.log('\n  儲存空間:');
      info.storage.forEach(storage => {
        console.log(`    ${storage.description}: ${chalk.green(storage.freeSpace)} / ${storage.totalSpace}`);
      });
    }
    console.log('');
  }
  
  /**
   * Show scan results
   */
  public showScanResults(results: {
    totalFiles: number;
    totalSize: string;
    newFiles: number;
    modifiedFiles: number;
    duplicateFiles: number;
  }): void {
    if (this.silent) return;
    
    console.log('');
    console.log(chalk.bold('📊 掃描結果:'));
    
    const items = [
      { label: '總檔案數', value: results.totalFiles, color: 'cyan' },
      { label: '總大小', value: results.totalSize, color: 'cyan' },
      { label: '新檔案', value: results.newFiles, color: 'green' },
      { label: '已修改', value: results.modifiedFiles, color: 'yellow' },
      { label: '重複檔案', value: results.duplicateFiles, color: 'gray' }
    ];
    
    items.forEach(item => {
      const valueStr = typeof item.value === 'number' ? item.value.toLocaleString() : item.value;
      console.log(`  ${item.label}: ${(chalk as any)[item.color](valueStr)}`);
    });
    
    console.log('');
  }
  
  /**
   * Start transfer progress
   */
  public startTransferProgress(totalFiles: number, totalBytes: number): void {
    if (this.silent) return;
    
    this.progressDisplay = new EnhancedProgressDisplay({
      useColor: this.config.useColor,
      detailed: this.config.verbose,
      showSpeed: true,
      showETA: true
    });
    
    this.progressDisplay.startTransfer(totalFiles, totalBytes);
  }
  
  /**
   * Update transfer progress
   */
  public updateProgress(progress: any): void {
    if (this.silent || !this.progressDisplay) return;
    
    this.progressDisplay.updateProgress(progress);
  }
  
  /**
   * Add file to transfer
   */
  public addFileTransfer(fileId: string, filename: string, size: number): void {
    if (this.silent || !this.progressDisplay) return;
    
    this.progressDisplay.addFile(fileId, filename, size);
  }
  
  /**
   * Update file progress
   */
  public updateFileProgress(fileId: string, transferred: number, total: number): void {
    if (this.silent || !this.progressDisplay) return;
    
    this.progressDisplay.updateFile(fileId, transferred, total);
  }
  
  /**
   * Complete file transfer
   */
  public completeFileTransfer(fileId: string, success: boolean = true): void {
    if (this.silent || !this.progressDisplay) return;
    
    this.progressDisplay.completeFile(fileId, success);
  }
  
  /**
   * Complete all transfers
   */
  public completeTransfer(stats: {
    successful: number;
    failed: number;
    skipped: number;
    totalTime?: number;
  }): void {
    if (this.silent) return;
    
    const totalTime = stats.totalTime || (Date.now() - this.startTime);
    
    if (this.progressDisplay) {
      this.progressDisplay.complete({
        successful: stats.successful,
        failed: stats.failed,
        totalTime
      });
    }
    
    // Show celebration for perfect transfer
    if (this.config.useAnimations && stats.failed === 0 && stats.successful > 0) {
      SuccessAnimation.celebrate('🎉 完美傳輸！所有檔案成功傳輸！');
    }
  }
  
  /**
   * Show error with details
   */
  public showError(error: Error | string, details?: string): void {
    const message = typeof error === 'string' ? error : error.message;
    
    if (this.progressDisplay) {
      this.progressDisplay.showError(message, details);
    } else {
      console.error(chalk.red(`❌ ${message}`));
      if (details && this.config.verbose) {
        console.error(chalk.dim(details));
      }
    }
  }
  
  /**
   * Show warning
   */
  public showWarning(message: string): void {
    if (this.silent) return;
    
    if (this.progressDisplay) {
      this.progressDisplay.showWarning(message);
    } else {
      console.warn(chalk.yellow(`⚠️ ${message}`));
    }
  }
  
  /**
   * Show info
   */
  public showInfo(message: string): void {
    if (this.silent) return;
    
    if (this.progressDisplay) {
      this.progressDisplay.showInfo(message);
    } else {
      console.log(chalk.blue(`ℹ️ ${message}`));
    }
  }
  
  /**
   * Show success
   */
  public showSuccess(message: string): void {
    if (this.silent) return;
    
    console.log(StatusMessage.success(message));
    
    if (this.config.useAnimations) {
      SuccessAnimation.checkmark(message);
    }
  }
  
  /**
   * Ask for confirmation
   */
  public async confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    // For now, return default value
    // TODO: Implement interactive confirmation
    console.log(chalk.yellow(`? ${message} ${defaultValue ? '(Y/n)' : '(y/N)'}`));
    return defaultValue;
  }
  
  /**
   * Show tips
   */
  public showTips(tips: string[]): void {
    if (this.silent || tips.length === 0) return;
    
    console.log('\n' + chalk.bold('💡 提示:'));
    tips.forEach(tip => {
      console.log(`  • ${tip}`);
    });
    console.log('');
  }
  
  /**
   * Create default logger
   */
  private createDefaultLogger(): Logger {
    return {
      info: (msg: string) => console.log(chalk.blue(`ℹ ${msg}`)),
      success: (msg: string) => console.log(chalk.green(`✓ ${msg}`)),
      warn: (msg: string) => console.warn(chalk.yellow(`⚠ ${msg}`)),
      error: (msg: string | Error) => console.error(chalk.red(`✗ ${typeof msg === 'string' ? msg : msg.message}`)),
      debug: (msg: string) => this.config.verbose && console.log(chalk.gray(`[DEBUG] ${msg}`))
    };
  }
  
  /**
   * Stop stage animation
   */
  private stopStageAnimation(): void {
    if (this.stageAnimation) {
      this.stageAnimation.stop();
      this.stageAnimation = undefined as any;
    }
  }
  
  /**
   * Get silent mode
   */
  private get silent(): boolean {
    return this.config.silent;
  }
}

/**
 * Factory function
 */
export function createUserFeedback(config?: FeedbackConfig): UserFeedback {
  return new UserFeedback(config);
}