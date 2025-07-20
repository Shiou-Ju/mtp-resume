/**
 * Generic command executor for running system commands with timeout and retry logic
 */

import { spawn, SpawnOptions } from 'child_process';
import { MTPCommandResult, MTPCommandOptions, MTPErrorCode } from '../types/mtp-types';

export class CommandRunner {
  private defaultTimeout: number;
  private defaultRetries: number;
  private debug: boolean;

  constructor(timeout: number = 30000, retries: number = 3, debug: boolean = false) {
    this.defaultTimeout = timeout;
    this.defaultRetries = retries;
    this.debug = debug;
  }

  /**
   * Execute a system command with timeout and retry logic
   */
  async executeCommand(
    command: string, 
    args: string[] = [], 
    options: MTPCommandOptions = {}
  ): Promise<MTPCommandResult> {
    const timeout = options.timeout || this.defaultTimeout;
    const retries = options.retries || this.defaultRetries;
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (this.debug) {
          console.log(`[CommandRunner] Attempt ${attempt}/${retries}: ${command} ${args.join(' ')}`);
        }
        
        const result = await this.runSingleCommand(command, args, options, timeout);
        
        if (this.debug) {
          console.log(`[CommandRunner] Success on attempt ${attempt}`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        if (this.debug) {
          console.log(`[CommandRunner] Attempt ${attempt} failed:`, error);
        }
        
        // Don't retry for certain types of errors
        if (error instanceof MTPError) {
          if (error.code === MTPErrorCode.DEVICE_NOT_FOUND ||
              error.code === MTPErrorCode.ACCESS_DENIED) {
            break;
          }
        }
        
        // Add delay between retries (exponential backoff)
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await this.sleep(delay);
        }
      }
    }
    
    // All retries failed
    throw lastError || new MTPError(
      `Command failed after ${retries} attempts: ${command}`,
      MTPErrorCode.COMMAND_FAILED
    );
  }

  /**
   * Run a single command execution
   */
  private async runSingleCommand(
    command: string,
    args: string[],
    options: MTPCommandOptions,
    timeout: number
  ): Promise<MTPCommandResult> {
    const startTime = Date.now();
    
    // Check for mock mode
    if (process.env.MTP_MOCK_MODE === 'true') {
      return this.runMockCommand(command, args, options, timeout, startTime);
    }
    
    return new Promise((resolve, reject) => {
      const spawnOptions: SpawnOptions = {
        cwd: options.workingDirectory,
        env: { ...process.env, ...options.environment },
        stdio: ['pipe', 'pipe', 'pipe']
      };
      
      const childProcess = spawn(command, args, spawnOptions);
      
      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;
      let resolved = false;
      
      // Set up timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            childProcess.kill('SIGTERM');
            
            // Force kill after additional 5 seconds
            setTimeout(() => {
              if (!childProcess.killed) {
                childProcess.kill('SIGKILL');
              }
            }, 5000);
            
            reject(new MTPError(
              `Command timeout after ${timeout}ms: ${command}`,
              MTPErrorCode.COMMAND_TIMEOUT
            ));
          }
        }, timeout);
      }
      
      // Collect stdout data
      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      // Collect stderr data
      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      
      // Handle process completion
      childProcess.on('close', (code: number | null, _signal: string | null) => {
        if (resolved) return;
        resolved = true;
        
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        const duration = Date.now() - startTime;
        const exitCode = code || 0;
        
        if (this.debug) {
          console.log(`[CommandRunner] Command completed: code=${exitCode}, duration=${duration}ms`);
          console.log(`[CommandRunner] stdout:`, stdout);
          console.log(`[CommandRunner] stderr:`, stderr);
        }
        
        if (exitCode === 0) {
          resolve({
            success: true,
            output: stdout,
            exitCode,
            duration
          });
        } else {
          reject(new MTPError(
            `Command failed with exit code ${exitCode}: ${command}\nError: ${stderr}`,
            this.classifyError(stderr, exitCode)
          ));
        }
      });
      
      // Handle process errors
      childProcess.on('error', (error: Error) => {
        if (resolved) return;
        resolved = true;
        
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        if (error.message.includes('ENOENT')) {
          reject(new MTPError(
            `Command not found: ${command}. Please ensure MTP tools are installed.`,
            MTPErrorCode.COMMAND_FAILED
          ));
        } else {
          reject(new MTPError(
            `Command execution error: ${error.message}`,
            MTPErrorCode.COMMAND_FAILED
          ));
        }
      });
    });
  }

  /**
   * Classify error based on stderr output and exit code
   */
  private classifyError(stderr: string, exitCode: number): MTPErrorCode {
    const errorText = stderr.toLowerCase();
    
    if (errorText.includes('no mtp devices found') || 
        errorText.includes('unable to open device') ||
        errorText.includes('no raw devices found')) {
      return MTPErrorCode.DEVICE_NOT_FOUND;
    }
    
    if (errorText.includes('device busy') || 
        errorText.includes('resource busy')) {
      return MTPErrorCode.DEVICE_BUSY;
    }
    
    if (errorText.includes('permission denied') || 
        errorText.includes('access denied') ||
        exitCode === 13) {
      return MTPErrorCode.ACCESS_DENIED;
    }
    
    if (errorText.includes('no such file') || 
        errorText.includes('file not found') ||
        exitCode === 2) {
      return MTPErrorCode.FILE_NOT_FOUND;
    }
    
    if (errorText.includes('transfer failed') || 
        errorText.includes('failed to get file')) {
      return MTPErrorCode.TRANSFER_FAILED;
    }
    
    return MTPErrorCode.COMMAND_FAILED;
  }

  /**
   * Check if a command is available in the system
   */
  async isCommandAvailable(command: string): Promise<boolean> {
    try {
      const result = await this.executeCommand('which', [command], { timeout: 5000, retries: 1 });
      return result.success && result.output.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get the version of an MTP command
   */
  async getCommandVersion(command: string): Promise<string | null> {
    try {
      const result = await this.executeCommand(command, ['--version'], { timeout: 5000, retries: 1 });
      if (result.success) {
        return result.output.trim();
      }
    } catch {
      // Ignore errors - some commands don't support --version
    }
    return null;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run command in mock mode
   */
  private async runMockCommand(
    command: string,
    args: string[],
    _options: MTPCommandOptions,
    _timeout: number,
    _startTime: number
  ): Promise<MTPCommandResult> {
    // Use the mock handler that's included in production build
    const { mockHandler } = await import('./mock-handler');
    
    try {
      const result = await mockHandler.execute(command, args);
      
      if (!result.success) {
        throw new MTPError(
          result.error || `Mock command failed: ${command}`,
          this.classifyError(result.error || '', result.exitCode),
          command
        );
      }
      
      return {
        success: true,
        output: result.output,
        exitCode: result.exitCode,
        duration: result.duration
      };
    } catch (error) {
      if (error instanceof MTPError) {
        throw error;
      }
      throw new MTPError(
        `Mock command error: ${error instanceof Error ? error.message : String(error)}`,
        MTPErrorCode.COMMAND_FAILED,
        command
      );
    }
  }
}

/**
 * Custom MTP Error class
 */
export class MTPError extends Error {
  public code: MTPErrorCode;
  public command?: string | undefined;
  public deviceInfo?: any;

  constructor(message: string, code: MTPErrorCode, command?: string) {
    super(message);
    this.name = 'MTPError';
    this.code = code;
    this.command = command;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MTPError);
    }
  }
}

// Export singleton instance for convenience
export const defaultCommandRunner = new CommandRunner();