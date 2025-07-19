/**
 * @fileoverview Enhanced Progress Display System
 * @description Advanced progress indicators with animations and rich feedback
 */

import { SingleBar, MultiBar, Presets } from 'cli-progress';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { performance } from 'perf_hooks';
import type { ProgressInfo } from '../types/cli-types';

/**
 * Enhanced progress configuration
 */
export interface EnhancedProgressConfig {
  /** Enable colors */
  useColor?: boolean;
  /** Show detailed information */
  detailed?: boolean;
  /** Update interval in ms */
  updateInterval?: number;
  /** Show transfer speed */
  showSpeed?: boolean;
  /** Show ETA */
  showETA?: boolean;
  /** Custom theme */
  theme?: ProgressTheme;
}

/**
 * Progress theme configuration
 */
export interface ProgressTheme {
  /** Success color */
  success: string;
  /** Error color */
  error: string;
  /** Warning color */
  warning: string;
  /** Info color */
  info: string;
  /** Progress bar color */
  progressBar: string;
  /** Icons */
  icons: {
    success: string;
    error: string;
    warning: string;
    info: string;
    transfer: string;
    folder: string;
    file: string;
  };
}

/**
 * Transfer statistics
 */
interface TransferStats {
  startTime: number;
  bytesTransferred: number;
  lastUpdateTime: number;
  lastBytesTransferred: number;
  speedHistory: number[];
  currentSpeed: number;
  averageSpeed: number;
  estimatedTimeRemaining: number;
}

/**
 * Default theme
 */
const DEFAULT_THEME: ProgressTheme = {
  success: 'green',
  error: 'red',
  warning: 'yellow',
  info: 'blue',
  progressBar: 'cyan',
  icons: {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    transfer: '📤',
    folder: '📁',
    file: '📄'
  }
};

/**
 * Enhanced progress display manager
 */
export class EnhancedProgressDisplay {
  private config: Required<EnhancedProgressConfig>;
  private theme: ProgressTheme;
  private multibar?: MultiBar;
  private overallBar?: SingleBar;
  private fileBars = new Map<string, SingleBar>();
  private spinner?: Ora;
  private stats: TransferStats;
  private updateTimer?: NodeJS.Timeout;
  private lastRenderTime: number = 0;
  
  constructor(config: EnhancedProgressConfig = {}) {
    this.config = {
      useColor: config.useColor ?? true,
      detailed: config.detailed ?? true,
      updateInterval: config.updateInterval ?? 100,
      showSpeed: config.showSpeed ?? true,
      showETA: config.showETA ?? true,
      theme: config.theme ?? DEFAULT_THEME
    };
    
    this.theme = this.config.theme;
    
    this.stats = {
      startTime: performance.now(),
      bytesTransferred: 0,
      lastUpdateTime: performance.now(),
      lastBytesTransferred: 0,
      speedHistory: [],
      currentSpeed: 0,
      averageSpeed: 0,
      estimatedTimeRemaining: 0
    };
  }
  
  /**
   * Start scanning animation
   */
  public startScanning(message: string = '掃描檔案中...'): void {
    this.spinner = ora({
      text: message,
      spinner: 'dots',
      color: 'blue'
    }).start();
  }
  
  /**
   * Update scanning message
   */
  public updateScanning(message: string, count?: number): void {
    if (this.spinner) {
      if (count !== undefined) {
        this.spinner.text = `${message} 找到 ${chalk.bold(count)} 個檔案`;
      } else {
        this.spinner.text = message;
      }
    }
  }
  
  /**
   * Stop scanning with result
   */
  public stopScanning(success: boolean = true, message?: string): void {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(message || '掃描完成');
      } else {
        this.spinner.fail(message || '掃描失敗');
      }
      this.spinner = undefined as any;
    }
  }
  
  /**
   * Initialize transfer display
   */
  public startTransfer(totalFiles: number, totalBytes: number): void {
    const theme = this.theme;
    
    // Display header
    console.log('\n' + (chalk as any)[theme.info](theme.icons.transfer + ' 開始傳輸...'));
    console.log(chalk.dim(`總檔案: ${totalFiles} 個，總大小: ${this.formatBytes(totalBytes)}`));
    console.log('');
    
    // Create multibar
    this.multibar = new MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: this.createOverallFormat(),
      formatBar: this.formatBar.bind(this)
    }, Presets.shades_classic);
    
    // Create overall progress bar
    this.overallBar = this.multibar.create(totalBytes, 0, {
      filename: '總進度',
      filesCompleted: 0,
      filesTotal: totalFiles,
      speed: '0 B/s',
      eta: '計算中...'
    });
    
    // Start update timer
    this.startUpdateTimer();
  }
  
  /**
   * Add file to transfer
   */
  public addFile(fileId: string, filename: string, size: number): void {
    if (this.multibar && this.config.detailed) {
      const bar = this.multibar.create(size, 0, {
        filename: this.truncateFilename(filename),
        speed: '0 B/s',
        eta: '∞'
      });
      
      this.fileBars.set(fileId, bar);
    }
  }
  
  /**
   * Update progress
   */
  public updateProgress(progress: ProgressInfo): void {
    // Update stats
    this.stats.bytesTransferred = progress.bytesTransferred;
    this.calculateSpeed();
    
    // Update overall bar
    if (this.overallBar) {
      this.overallBar.update(progress.bytesTransferred, {
        filename: '總進度',
        filesCompleted: progress.filesCompleted,
        filesTotal: progress.filesTotal,
        speed: this.formatSpeed(this.stats.currentSpeed),
        eta: this.formatETA(this.stats.estimatedTimeRemaining)
      });
    }
  }
  
  /**
   * Update file progress
   */
  public updateFile(fileId: string, transferred: number, total: number): void {
    const bar = this.fileBars.get(fileId);
    if (bar) {
      const fileSpeed = this.calculateFileSpeed(fileId, transferred);
      const fileETA = total > 0 && fileSpeed > 0 
        ? (total - transferred) / fileSpeed 
        : 0;
      
      bar.update(transferred, {
        speed: this.formatSpeed(fileSpeed),
        eta: this.formatETA(fileETA)
      });
    }
  }
  
  /**
   * Complete file transfer
   */
  public completeFile(fileId: string, success: boolean = true): void {
    const bar = this.fileBars.get(fileId);
    if (bar) {
      bar.stop();
      this.fileBars.delete(fileId);
      
      // Show completion message
      const icon = success ? this.theme.icons.success : this.theme.icons.error;
      const status = success ? '完成' : '失敗';
      
      if (!this.config.detailed) {
        console.log(`${icon} ${status}: ${fileId}`);
      }
    }
  }
  
  /**
   * Complete all transfers
   */
  public complete(stats: { successful: number; failed: number; totalTime: number }): void {
    // Stop update timer
    this.stopUpdateTimer();
    
    // Stop all bars
    if (this.multibar) {
      this.multibar.stop();
    }
    
    // Display completion statistics
    console.log('\n' + (chalk as any)[this.theme.success](this.theme.icons.success + ' 傳輸完成！'));
    console.log((chalk as any)[this.theme.info]('📊 統計資訊:'));
    
    const table = [
      ['成功', chalk.green(stats.successful + ' 個檔案')],
      ['失敗', stats.failed > 0 ? chalk.red(stats.failed + ' 個檔案') : chalk.dim('0 個檔案')],
      ['總時間', this.formatDuration(stats.totalTime / 1000)],
      ['平均速度', this.formatSpeed(this.stats.averageSpeed)]
    ];
    
    table.forEach(([label, value]) => {
      console.log(`  ${label}: ${value}`);
    });
    
    // Show success rate bar
    const successRate = stats.successful / (stats.successful + stats.failed) * 100;
    const rateBar = this.createRateBar(successRate);
    console.log(`  成功率: ${rateBar} ${successRate.toFixed(1)}%`);
  }
  
  /**
   * Show error
   */
  public showError(message: string, details?: string): void {
    console.log('\n' + (chalk as any)[this.theme.error](this.theme.icons.error + ' ' + message));
    if (details && this.config.detailed) {
      console.log(chalk.dim(details));
    }
  }
  
  /**
   * Show warning
   */
  public showWarning(message: string): void {
    console.log((chalk as any)[this.theme.warning](this.theme.icons.warning + ' ' + message));
  }
  
  /**
   * Show info
   */
  public showInfo(message: string): void {
    console.log((chalk as any)[this.theme.info](this.theme.icons.info + ' ' + message));
  }
  
  /**
   * Calculate transfer speed
   */
  private calculateSpeed(): void {
    const now = performance.now();
    const timeDiff = (now - this.stats.lastUpdateTime) / 1000; // seconds
    
    if (timeDiff > 0.1) { // Update every 100ms
      const bytesDiff = this.stats.bytesTransferred - this.stats.lastBytesTransferred;
      const speed = bytesDiff / timeDiff;
      
      // Update speed history (keep last 10 samples)
      this.stats.speedHistory.push(speed);
      if (this.stats.speedHistory.length > 10) {
        this.stats.speedHistory.shift();
      }
      
      // Calculate current and average speed
      this.stats.currentSpeed = speed;
      this.stats.averageSpeed = this.stats.speedHistory.reduce((a, b) => a + b, 0) / this.stats.speedHistory.length;
      
      // Update last values
      this.stats.lastUpdateTime = now;
      this.stats.lastBytesTransferred = this.stats.bytesTransferred;
      
      // Calculate ETA
      if (this.overallBar && this.stats.averageSpeed > 0) {
        const totalBytes = this.overallBar.getTotal();
        const remaining = totalBytes - this.stats.bytesTransferred;
        this.stats.estimatedTimeRemaining = remaining / this.stats.averageSpeed;
      }
    }
  }
  
  /**
   * Calculate file-specific speed
   */
  private fileSpeedCache = new Map<string, { lastBytes: number; lastTime: number; speed: number }>();
  
  private calculateFileSpeed(fileId: string, currentBytes: number): number {
    const cache = this.fileSpeedCache.get(fileId) || { lastBytes: 0, lastTime: performance.now(), speed: 0 };
    const now = performance.now();
    const timeDiff = (now - cache.lastTime) / 1000;
    
    if (timeDiff > 0.1) {
      const bytesDiff = currentBytes - cache.lastBytes;
      cache.speed = bytesDiff / timeDiff;
      cache.lastBytes = currentBytes;
      cache.lastTime = now;
      this.fileSpeedCache.set(fileId, cache);
    }
    
    return cache.speed;
  }
  
  /**
   * Format functions
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
  
  private formatSpeed(bytesPerSecond: number): string {
    return `${this.formatBytes(bytesPerSecond)}/s`;
  }
  
  private formatDuration(seconds: number): string {
    if (seconds < 0) return '∞';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}時${minutes.toString().padStart(2, '0')}分${secs.toString().padStart(2, '0')}秒`;
    } else if (minutes > 0) {
      return `${minutes}分${secs.toString().padStart(2, '0')}秒`;
    } else {
      return `${secs}秒`;
    }
  }
  
  private formatETA(seconds: number): string {
    if (seconds <= 0 || !isFinite(seconds)) return '計算中...';
    return this.formatDuration(seconds);
  }
  
  private truncateFilename(filename: string, maxLength: number = 40): string {
    if (filename.length <= maxLength) return filename;
    const start = filename.substring(0, 15);
    const end = filename.substring(filename.length - 22);
    return `${start}...${end}`;
  }
  
  /**
   * Create format strings
   */
  private createOverallFormat(): string {
    const parts = ['進度: {bar} {percentage}%'];
    
    if (this.config.detailed) {
      parts.push('| {filesCompleted}/{filesTotal} 檔案');
    }
    
    if (this.config.showSpeed) {
      parts.push('| {speed}');
    }
    
    if (this.config.showETA) {
      parts.push('| 剩餘: {eta}');
    }
    
    return parts.join(' ');
  }
  
  /**
   * Format progress bar with colors
   */
  private formatBar(progress: number, options: any): string {
    const completeSize = Math.round(progress * options.barsize);
    const incompleteSize = options.barsize - completeSize;
    
    const complete = options.barCompleteChar.repeat(completeSize);
    const incomplete = options.barIncompleteChar.repeat(incompleteSize);
    
    if (this.config.useColor) {
      return `[${(chalk as any)[this.theme.progressBar](complete)}${chalk.dim(incomplete)}]`;
    } else {
      return `[${complete}${incomplete}]`;
    }
  }
  
  /**
   * Create success rate bar
   */
  private createRateBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const color = percentage >= 90 ? this.theme.success : 
                  percentage >= 70 ? this.theme.warning : 
                  this.theme.error;
    
    return (chalk as any)[color](`[${bar}]`);
  }
  
  /**
   * Update timer management
   */
  private startUpdateTimer(): void {
    this.updateTimer = setInterval(() => {
      const now = performance.now();
      if (now - this.lastRenderTime > this.config.updateInterval) {
        this.calculateSpeed();
        this.lastRenderTime = now;
      }
    }, this.config.updateInterval);
  }
  
  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined as any;
    }
  }
}

/**
 * Factory function for creating progress display
 */
export function createEnhancedProgress(config?: EnhancedProgressConfig): EnhancedProgressDisplay {
  return new EnhancedProgressDisplay(config);
}