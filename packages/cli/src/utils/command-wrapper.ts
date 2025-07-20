/**
 * @fileoverview Command Wrapper with Error Handling
 * @description Wrapper for commands with unified error handling and validation
 */

import { createLogger } from './logger';
import { handleError } from './error-handler';
import type { CommandContext, GlobalOptions } from '../types/cli-types';

/**
 * Command execution options
 */
interface CommandWrapperOptions {
  requireMTP?: boolean;
  requireDatabase?: boolean;
  validatePaths?: string[];
  timeoutMs?: number;
}

/**
 * Wrap command execution with error handling
 */
export function withErrorHandling<T extends any[], R>(
  commandName: string,
  commandFn: (...args: T) => Promise<R>,
  options: CommandWrapperOptions = {}
) {
  return async (...args: T): Promise<R> => {
    const logger = createLogger({ 
      useColor: !process.env.NO_COLOR, 
      verbose: process.argv.includes('--verbose') 
    });

    try {
      // Pre-execution validation
      if (options.validatePaths) {
        await validatePaths(options.validatePaths);
      }

      // Set timeout if specified
      if (options.timeoutMs) {
        return await Promise.race([
          commandFn(...args),
          createTimeout<R>(options.timeoutMs)
        ]);
      }

      return await commandFn(...args);
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)), logger, {
        command: commandName,
        operation: 'command_execution'
      });
    }
  };
}

/**
 * Validate file paths exist
 */
async function validatePaths(paths: string[]): Promise<void> {
  const { promises: fs } = await import('fs');
  
  for (const path of paths) {
    try {
      await fs.access(path);
    } catch {
      throw new Error(`檔案或路徑不存在: ${path}`);
    }
  }
}

/**
 * Create timeout promise
 */
function createTimeout<T>(ms: number): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`命令執行逾時 (${ms}ms)`));
    }, ms);
  });
}

/**
 * Safe command wrapper that catches all errors
 */
export function safeCommand<T extends any[], R>(
  commandName: string,
  commandFn: (...args: T) => Promise<R>
) {
  return withErrorHandling(commandName, commandFn);
}

/**
 * Command wrapper with MTP requirement
 */
export function mtpCommand<T extends any[], R>(
  commandName: string,
  commandFn: (...args: T) => Promise<R>
) {
  return withErrorHandling(commandName, commandFn, {
    requireMTP: true
  });
}

/**
 * Command wrapper with database requirement
 */
export function databaseCommand<T extends any[], R>(
  commandName: string,
  commandFn: (...args: T) => Promise<R>
) {
  return withErrorHandling(commandName, commandFn, {
    requireDatabase: true
  });
}

/**
 * Enhanced command context with error handling
 */
export class EnhancedCommandContext<T extends GlobalOptions> implements CommandContext<T> {
  public options: T;
  public command: string;
  public startTime: Date;
  private logger: ReturnType<typeof createLogger>;

  constructor(context: CommandContext<T>) {
    this.options = context.options;
    this.command = context.command;
    this.startTime = context.startTime;
    this.logger = createLogger({ 
      useColor: !context.options.noColor, 
      verbose: context.options.verbose || false 
    });
  }

  /**
   * Handle error with context
   */
  handleError(error: Error | string, operation?: string): never {
    const context: { command: string; operation?: string } = {
      command: this.command
    };
    
    if (operation) {
      context.operation = operation;
    }
    
    return handleError(
      error instanceof Error ? error : new Error(String(error)), 
      this.logger, 
      context
    );
  }

  /**
   * Log message with context
   */
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
    this.logger[level](message);
  }

  /**
   * Validate required options
   */
  validateRequired(requiredOptions: string[]): void {
    const opts = this.options as any;
    for (const option of requiredOptions) {
      if (!(option in opts) || opts[option] == null) {
        this.handleError(new Error(`缺少必要參數: --${option}`), 'validation');
      }
    }
  }

  /**
   * Validate file paths
   */
  async validatePaths(paths: string[]): Promise<void> {
    try {
      await validatePaths(paths);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), 'path_validation');
    }
  }

  /**
   * Get elapsed time
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime.getTime();
  }
}

/**
 * Create enhanced command context
 */
export function createEnhancedContext<T extends GlobalOptions>(context: CommandContext<T>): EnhancedCommandContext<T> {
  return new EnhancedCommandContext(context);
}