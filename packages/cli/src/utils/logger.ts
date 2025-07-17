/**
 * @fileoverview Logger Utility
 * @description Simple logger for CLI output
 */

import chalk from 'chalk';
import type { Logger } from '../types/cli-types';

/**
 * Logger implementation
 */
export class CLILogger implements Logger {
  private useColor: boolean;
  private verbose: boolean;

  constructor(options: { useColor?: boolean; verbose?: boolean } = {}) {
    this.useColor = options.useColor ?? true;
    this.verbose = options.verbose ?? false;
  }

  /**
   * Log info message
   */
  info(message: string): void {
    console.log(this.format('info', message));
  }

  /**
   * Log success message
   */
  success(message: string): void {
    console.log(this.format('success', message));
  }

  /**
   * Log warning message
   */
  warn(message: string): void {
    console.warn(this.format('warn', message));
  }

  /**
   * Log error message
   */
  error(message: string | Error): void {
    const msg = message instanceof Error ? message.message : message;
    console.error(this.format('error', msg));
    
    if (this.verbose && message instanceof Error && message.stack) {
      console.error(chalk.dim(message.stack));
    }
  }

  /**
   * Log debug message (only in verbose mode)
   */
  debug(message: string): void {
    if (this.verbose) {
      console.log(this.format('debug', message));
    }
  }

  /**
   * Format message with color and prefix
   */
  private format(level: string, message: string): string {
    if (!this.useColor) {
      return `[${level.toUpperCase()}] ${message}`;
    }

    switch (level) {
      case 'info':
        return chalk.blue('ℹ') + ' ' + message;
      case 'success':
        return chalk.green('✓') + ' ' + message;
      case 'warn':
        return chalk.yellow('⚠') + ' ' + message;
      case 'error':
        return chalk.red('✗') + ' ' + message;
      case 'debug':
        return chalk.dim('[DEBUG]') + ' ' + chalk.dim(message);
      default:
        return message;
    }
  }
}

/**
 * Create logger instance
 */
export function createLogger(options: { useColor?: boolean; verbose?: boolean } = {}): Logger {
  return new CLILogger(options);
}