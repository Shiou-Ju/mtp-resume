/**
 * CLI Runner Utility for E2E Testing
 * Provides methods to execute the CLI and capture output
 */

import { spawn, SpawnOptions } from 'child_process'
import path from 'path'

export interface CLIResult {
  stdout: string
  stderr: string
  exitCode: number
  duration: number
}

export interface CLIOptions {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
  input?: string
}

export class CLIRunner {
  private cliPath: string

  constructor(cliPath?: string) {
    // Default to the CLI entry point
    this.cliPath = cliPath || path.join(__dirname, '..', '..', 'dist', 'index.js')
  }

  /**
   * Execute CLI command with arguments
   */
  async run(args: string[], options: CLIOptions = {}): Promise<CLIResult> {
    const startTime = Date.now()
    
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        // Force non-interactive mode for testing
        CI: 'true',
        NO_COLOR: '1',
        ...options.env
      }

      const spawnOptions: SpawnOptions = {
        cwd: options.cwd || process.cwd(),
        env,
        timeout: options.timeout || 30000
      }

      const proc = spawn('node', [this.cliPath, ...args], spawnOptions)
      
      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      // Handle input if provided
      if (options.input) {
        proc.stdin.write(options.input)
        proc.stdin.end()
      }

      proc.on('error', (error) => {
        reject(error)
      })

      proc.on('close', (code) => {
        const duration = Date.now() - startTime
        
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
          duration
        })
      })

      // Handle timeout
      if (options.timeout) {
        setTimeout(() => {
          proc.kill('SIGTERM')
        }, options.timeout)
      }
    })
  }

  /**
   * Run command and expect success
   */
  async runSuccess(args: string[], options?: CLIOptions): Promise<CLIResult> {
    const result = await this.run(args, options)
    
    if (result.exitCode !== 0) {
      throw new Error(
        `CLI exited with code ${result.exitCode}\n` +
        `stdout: ${result.stdout}\n` +
        `stderr: ${result.stderr}`
      )
    }
    
    return result
  }

  /**
   * Run command and expect failure
   */
  async runFail(args: string[], options?: CLIOptions): Promise<CLIResult> {
    const result = await this.run(args, options)
    
    if (result.exitCode === 0) {
      throw new Error('Expected CLI to fail but it succeeded')
    }
    
    return result
  }

  /**
   * Run command with mock MTP mode
   */
  async runMocked(args: string[], options: CLIOptions = {}): Promise<CLIResult> {
    return this.run(args, {
      ...options,
      env: {
        MTP_MOCK_MODE: 'true',
        ...options.env
      }
    })
  }

  /**
   * Parse JSON output from CLI
   */
  parseJSON<T = any>(output: string): T {
    try {
      return JSON.parse(output)
    } catch (error) {
      throw new Error(`Failed to parse JSON output: ${output}`)
    }
  }

  /**
   * Extract progress updates from output
   */
  extractProgress(output: string): number[] {
    const progressRegex = /(\d+(?:\.\d+)?)%/g
    const matches = output.match(progressRegex) || []
    
    return matches.map(match => parseFloat(match.replace('%', '')))
  }
}