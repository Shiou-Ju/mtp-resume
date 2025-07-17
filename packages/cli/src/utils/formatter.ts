/**
 * @fileoverview Output Formatter Utilities
 * @description Utilities for formatting CLI output
 */

import chalk from 'chalk';
// @ts-ignore - cli-table3 沒有官方類型定義
import Table from 'cli-table3';
import type {
  DeviceDisplay,
  FileDisplay,
  ListOptions,
  ProgressInfo,
  OutputFormatter
} from '../types/cli-types';

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format date to readable format
 */
export function formatDate(date: Date | undefined): string {
  if (!date) return '-';
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return date.toLocaleTimeString();
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Format transfer speed
 */
export function formatSpeed(bytesPerSecond: number | undefined): string {
  if (!bytesPerSecond) return '-';
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Format time duration
 */
export function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds < 0) return '-';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}小時${minutes}分`;
  } else if (minutes > 0) {
    return `${minutes}分${secs}秒`;
  } else {
    return `${secs}秒`;
  }
}

/**
 * Default output formatter implementation
 */
export class DefaultFormatter implements OutputFormatter {
  private useColor: boolean;

  constructor(useColor: boolean = true) {
    this.useColor = useColor;
  }

  /**
   * Format device information for display
   */
  formatDevice(device: DeviceDisplay): string {
    const lines: string[] = [];
    
    lines.push(this.color('green', '✓ 找到 MTP 裝置'));
    lines.push('');
    lines.push(this.color('bold', '裝置資訊:'));
    lines.push(`  廠商: ${device.vendor}`);
    lines.push(`  型號: ${device.model}`);
    lines.push(`  序號: ${device.serialNumber}`);
    lines.push(`  狀態: ${this.colorStatus(device.status)}`);
    
    if (device.storage && device.storage.length > 0) {
      lines.push('');
      lines.push(this.color('bold', '儲存空間:'));
      
      device.storage.forEach(storage => {
        lines.push(`  ${storage.description}:`);
        lines.push(`    已使用: ${this.formatStorageBar(storage.usedPercentage)}`);
        lines.push(`    可用空間: ${storage.freeSpace} / ${storage.totalSpace}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Format file list for display
   */
  formatFiles(files: FileDisplay[], options: ListOptions): string {
    if (files.length === 0) {
      return this.color('yellow', '沒有找到檔案');
    }

    // Sort files if requested
    if (options.sort) {
      files = this.sortFiles(files, options.sort, options.reverse);
    }

    // Format based on output format
    switch (options.format) {
      case 'json':
        return JSON.stringify(files, null, 2);
      
      case 'tree':
        return this.formatAsTree(files);
      
      case 'table':
      default:
        return this.formatAsTable(files);
    }
  }

  /**
   * Format progress information
   */
  formatProgress(progress: ProgressInfo): string {
    const percentage = Math.round(progress.percentage);
    const bar = this.createProgressBar(percentage, 30);
    
    const parts = [
      bar,
      `${percentage}%`,
      `| ${progress.currentFile}`,
      `| ${formatSpeed(progress.speed)}`,
      `| ETA: ${formatDuration(progress.eta)}`
    ];
    
    return parts.join(' ');
  }

  /**
   * Format error message
   */
  formatError(error: Error, verbose: boolean): string {
    if (verbose) {
      return this.color('red', `錯誤: ${error.message}\n${error.stack || ''}`);
    } else {
      return this.color('red', `錯誤: ${error.message}`);
    }
  }

  /**
   * Apply color if enabled
   */
  private color(style: string, text: string): string {
    if (!this.useColor) return text;
    
    switch (style) {
      case 'green': return chalk.green(text);
      case 'red': return chalk.red(text);
      case 'yellow': return chalk.yellow(text);
      case 'blue': return chalk.blue(text);
      case 'bold': return chalk.bold(text);
      case 'dim': return chalk.dim(text);
      default: return text;
    }
  }

  /**
   * Color status text
   */
  private colorStatus(status: string): string {
    switch (status.toLowerCase()) {
      case 'connected':
        return this.color('green', '已連接');
      case 'disconnected':
        return this.color('red', '未連接');
      case 'busy':
        return this.color('yellow', '忙碌中');
      default:
        return status;
    }
  }

  /**
   * Create storage usage bar
   */
  private formatStorageBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const color = percentage > 90 ? 'red' : percentage > 70 ? 'yellow' : 'green';
    
    return `${this.color(color, bar)} ${percentage}%`;
  }

  /**
   * Create progress bar
   */
  private createProgressBar(percentage: number, width: number): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${this.color('green', bar)}]`;
  }

  /**
   * Sort files
   */
  private sortFiles(files: FileDisplay[], sort: string, reverse?: boolean): FileDisplay[] {
    const sorted = [...files].sort((a, b) => {
      switch (sort) {
        case 'size':
          return this.parseSize(a.size) - this.parseSize(b.size);
        case 'date':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });
    
    return reverse ? sorted.reverse() : sorted;
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(size: string): number {
    const match = size.match(/^([\d.]+)\s*([KMGT]?B)$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };
    
    return value * (multipliers[unit] || 1);
  }

  /**
   * Format files as table
   */
  private formatAsTable(files: FileDisplay[]): string {
    const table = new Table({
      head: ['名稱', '大小', '修改時間', '類型'],
      style: {
        head: this.useColor ? ['cyan'] : []
      }
    });
    
    files.forEach(file => {
      const typeIcon = file.type === 'folder' ? '📁' : '📄';
      table.push([
        file.name,
        file.size,
        file.date,
        `${typeIcon} ${file.type}`
      ]);
    });
    
    return table.toString();
  }

  /**
   * Format files as tree
   */
  private formatAsTree(files: FileDisplay[]): string {
    // Group files by directory
    const tree = new Map<string, FileDisplay[]>();
    
    files.forEach(file => {
      const dir = file.path.substring(0, file.path.lastIndexOf('/'));
      if (!tree.has(dir)) {
        tree.set(dir, []);
      }
      tree.get(dir)!.push(file);
    });
    
    // Build tree output
    const lines: string[] = [];
    let currentPath = '';
    
    Array.from(tree.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([path, dirFiles]) => {
      if (path !== currentPath) {
        lines.push(this.color('bold', path + '/'));
        currentPath = path;
      }
      
      dirFiles.forEach((file, index) => {
        const isLast = index === dirFiles.length - 1;
        const prefix = isLast ? '└── ' : '├── ';
        const typeIcon = file.type === 'folder' ? '📁' : '📄';
        lines.push(`${prefix}${typeIcon} ${file.name} (${file.size})`);
      });
    });
    
    return lines.join('\n');
  }
}

/**
 * Create a formatter instance
 */
export function createFormatter(useColor: boolean = true): OutputFormatter {
  return new DefaultFormatter(useColor);
}