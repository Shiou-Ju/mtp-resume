/**
 * @fileoverview Progress Display Utilities
 * @description Tools for displaying transfer progress
 */

import { SingleBar, MultiBar, Presets } from 'cli-progress';
import chalk from 'chalk';
import type { ProgressInfo } from '../types/cli-types';

/**
 * Progress bar configuration
 */
interface ProgressConfig {
  /** Use colors */
  useColor: boolean;
  /** Show detailed information */
  detailed: boolean;
  /** Custom format */
  format?: string;
}

/**
 * Single file progress bar
 */
export class FileProgressBar {
  private bar: SingleBar;
  private config: ProgressConfig;

  constructor(config: ProgressConfig = { useColor: true, detailed: true }) {
    this.config = config;
    
    const format = config.format || this.createDefaultFormat();
    
    this.bar = new SingleBar({
      format,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
      formatBar: this.formatBar.bind(this)
    }, Presets.shades_classic);
  }

  /**
   * Start progress bar
   */
  public start(total: number, initial: number = 0): void {
    this.bar.start(total, initial);
  }

  /**
   * Update progress
   */
  public update(current: number, payload?: any): void {
    this.bar.update(current, payload);
  }

  /**
   * Stop progress bar
   */
  public stop(): void {
    this.bar.stop();
  }

  /**
   * Create default format string
   */
  private createDefaultFormat(): string {
    const parts = [
      '{bar}',
      '{percentage}%',
      '| {value}/{total}',
      '| {filename}',
      '| {speed}',
      '| ETA: {eta}'
    ];

    return parts.join(' ');
  }

  /**
   * Format the progress bar
   */
  private formatBar(progress: number, options: any): string {
    const completeSize = Math.round(progress * options.barsize);
    const incompleteSize = options.barsize - completeSize;
    
    const complete = options.barCompleteChar.repeat(completeSize);
    const incomplete = options.barIncompleteChar.repeat(incompleteSize);
    
    if (this.config.useColor) {
      return `[${chalk.green(complete)}${chalk.dim(incomplete)}]`;
    } else {
      return `[${complete}${incomplete}]`;
    }
  }
}

/**
 * Multi-file progress display
 */
export class MultiFileProgressBar {
  private multibar: MultiBar;
  private bars = new Map<string, SingleBar>();
  private config: ProgressConfig;

  constructor(config: ProgressConfig = { useColor: true, detailed: true }) {
    this.config = config;
    
    this.multibar = new MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: this.createFileFormat(),
      formatBar: this.formatBar.bind(this)
    }, Presets.shades_classic);
  }

  /**
   * Add a file to track
   */
  public addFile(fileId: string, filename: string, totalSize: number): void {
    const bar = this.multibar.create(totalSize, 0, {
      filename: this.truncateFilename(filename),
      fileId,
      speed: '0 B/s',
      eta: '∞'
    });
    
    this.bars.set(fileId, bar);
  }

  /**
   * Update file progress
   */
  public updateFile(fileId: string, current: number, payload?: any): void {
    const bar = this.bars.get(fileId);
    if (bar) {
      bar.update(current, payload);
    }
  }

  /**
   * Complete a file
   */
  public completeFile(fileId: string): void {
    const bar = this.bars.get(fileId);
    if (bar) {
      bar.stop();
      this.bars.delete(fileId);
    }
  }

  /**
   * Stop all progress bars
   */
  public stop(): void {
    this.multibar.stop();
    this.bars.clear();
  }

  /**
   * Create file format string
   */
  private createFileFormat(): string {
    return '{bar} {percentage}% | {filename} | {speed} | ETA: {eta}';
  }

  /**
   * Format progress bar
   */
  private formatBar(progress: number, options: any): string {
    const completeSize = Math.round(progress * options.barsize);
    const incompleteSize = options.barsize - completeSize;
    
    const complete = options.barCompleteChar.repeat(completeSize);
    const incomplete = options.barIncompleteChar.repeat(incompleteSize);
    
    if (this.config.useColor) {
      return `[${chalk.green(complete)}${chalk.dim(incomplete)}]`;
    } else {
      return `[${complete}${incomplete}]`;
    }
  }

  /**
   * Truncate filename for display
   */
  private truncateFilename(filename: string, maxLength: number = 30): string {
    if (filename.length <= maxLength) return filename;
    
    const start = filename.substring(0, 10);
    const end = filename.substring(filename.length - 17);
    return `${start}...${end}`;
  }
}

/**
 * Overall transfer progress display
 */
export class TransferProgressDisplay {
  private overallBar: SingleBar;
  private fileProgressBar?: MultiFileProgressBar;
  private config: ProgressConfig;
  private lastUpdateTime: number = 0;
  private updateThrottle: number = 100; // 100ms throttle
  private terminalWidth: number;
  private startTime: number = 0;
  private lastBytes: number = 0;
  private speedHistory: number[] = [];
  private maxSpeedSamples: number = 10;

  constructor(config: ProgressConfig = { useColor: true, detailed: true }) {
    this.config = config;
    this.terminalWidth = process.stdout.columns || 80;
    
    // Listen for terminal resize
    process.stdout.on('resize', () => {
      this.terminalWidth = process.stdout.columns || 80;
      this.updateBarSize();
    });
    
    // Create overall progress bar
    this.overallBar = new SingleBar({
      format: this.createOverallFormat(),
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      formatBar: this.formatBar.bind(this),
      barsize: Math.max(20, Math.floor(this.terminalWidth * 0.3))
    }, Presets.shades_classic);

    // Create file progress bar if detailed mode
    if (config.detailed) {
      this.fileProgressBar = new MultiFileProgressBar(config);
    }
  }

  /**
   * Update bar size based on terminal width
   */
  private updateBarSize(): void {
    // Note: cli-progress doesn't support dynamic bar size update
    // This is for future enhancement
    // const newBarSize = Math.max(20, Math.floor(this.terminalWidth * 0.3));
  }

  /**
   * Start transfer progress display
   */
  public start(totalFiles: number, totalBytes: number): void {
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.lastBytes = 0;
    
    console.log(chalk.blue('📁 開始傳輸...'));
    console.log(chalk.dim(`總檔案: ${totalFiles} 個，總大小: ${this.formatBytes(totalBytes)}`));
    console.log('');
    
    this.overallBar.start(totalBytes, 0, {
      filesCompleted: 0,
      filesTotal: totalFiles,
      speed: '0 B/s',
      eta: '∞'
    });
  }

  /**
   * Update overall progress
   */
  public updateOverall(progress: ProgressInfo): void {
    const now = Date.now();
    
    // Throttle updates to prevent flickering
    if (now - this.lastUpdateTime < this.updateThrottle) {
      return;
    }
    
    // Calculate actual speed
    const timeDiff = (now - this.lastUpdateTime) / 1000; // seconds
    const bytesDiff = progress.bytesTransferred - this.lastBytes;
    const currentSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
    
    // Update speed history for smoothing
    this.speedHistory.push(currentSpeed);
    if (this.speedHistory.length > this.maxSpeedSamples) {
      this.speedHistory.shift();
    }
    
    // Calculate average speed
    const avgSpeed = this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length;
    
    // Calculate more accurate ETA
    const remainingBytes = (progress.bytesTotal || 0) - progress.bytesTransferred;
    const eta = avgSpeed > 0 ? remainingBytes / avgSpeed : undefined;
    
    // Update tracking
    this.lastUpdateTime = now;
    this.lastBytes = progress.bytesTransferred;
    
    const speed = this.formatBytes(avgSpeed) + '/s';
    const etaStr = this.formatDuration(eta);
    
    this.overallBar.update(progress.bytesTransferred, {
      filesCompleted: progress.filesCompleted,
      filesTotal: progress.filesTotal,
      speed,
      eta: etaStr
    });
  }

  /**
   * Add file to detailed progress
   */
  public addFile(fileId: string, filename: string, size: number): void {
    if (this.fileProgressBar) {
      this.fileProgressBar.addFile(fileId, filename, size);
    }
  }

  /**
   * Update file progress
   */
  public updateFile(fileId: string, transferred: number, speed?: number): void {
    if (this.fileProgressBar) {
      const speedStr = speed ? this.formatBytes(speed) + '/s' : '0 B/s';
      this.fileProgressBar.updateFile(fileId, transferred, { speed: speedStr });
    }
  }

  /**
   * Complete file transfer
   */
  public completeFile(fileId: string): void {
    if (this.fileProgressBar) {
      this.fileProgressBar.completeFile(fileId);
    }
  }

  /**
   * Complete all transfers
   */
  public complete(stats: { successful: number; failed: number; totalTime: number }): void {
    this.overallBar.stop();
    
    if (this.fileProgressBar) {
      this.fileProgressBar.stop();
    }

    const totalDuration = (Date.now() - this.startTime) / 1000;
    const avgSpeed = this.speedHistory.length > 0 
      ? this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length
      : 0;

    console.log('\n' + chalk.green('✅ 傳輸完成！'));
    console.log(chalk.blue('📊 統計資訊:'));
    console.log(`  成功: ${chalk.green(stats.successful)} 個檔案`);
    if (stats.failed > 0) {
      console.log(`  失敗: ${chalk.red(stats.failed)} 個檔案`);
    }
    console.log(`  總時間: ${this.formatDuration(totalDuration)}`);
    console.log(`  平均速度: ${this.formatBytes(avgSpeed)}/s`);
    
    // Show peak speed if available
    if (this.speedHistory.length > 0) {
      const peakSpeed = Math.max(...this.speedHistory);
      console.log(`  峰值速度: ${this.formatBytes(peakSpeed)}/s`);
    }
  }

  /**
   * Handle error
   */
  public error(message: string): void {
    this.overallBar.stop();
    
    if (this.fileProgressBar) {
      this.fileProgressBar.stop();
    }

    console.log('\n' + chalk.red('❌ 傳輸失敗'));
    console.log(chalk.red(`錯誤: ${message}`));
  }

  /**
   * Create overall format string
   */
  private createOverallFormat(): string {
    // Adjust format based on terminal width
    if (this.terminalWidth < 80) {
      // Compact format for narrow terminals
      return '{bar} {percentage}% | {filesCompleted}/{filesTotal} | {speed}';
    } else if (this.terminalWidth < 120) {
      // Standard format
      return '總進度: {bar} {percentage}% | {filesCompleted}/{filesTotal} 檔案 | {speed} | ETA: {eta}';
    } else {
      // Detailed format for wide terminals
      return '📦 總進度: {bar} {percentage}% | {filesCompleted}/{filesTotal} 檔案 | 速度: {speed} | 剩餘時間: {eta}';
    }
  }

  /**
   * Format progress bar
   */
  private formatBar(progress: number, options: any): string {
    const completeSize = Math.round(progress * options.barsize);
    const incompleteSize = options.barsize - completeSize;
    
    const complete = options.barCompleteChar.repeat(completeSize);
    const incomplete = options.barIncompleteChar.repeat(incompleteSize);
    
    if (this.config.useColor) {
      return `[${chalk.green(complete)}${chalk.dim(incomplete)}]`;
    } else {
      return `[${complete}${incomplete}]`;
    }
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Format duration
   */
  private formatDuration(seconds: number | undefined): string {
    if (!seconds || seconds < 0) return '∞';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}時${minutes}分`;
    } else if (minutes > 0) {
      return `${minutes}分${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  }
}

/**
 * Create a simple progress display
 */
export function createProgressDisplay(config: ProgressConfig = { useColor: true, detailed: true }): TransferProgressDisplay {
  return new TransferProgressDisplay(config);
}