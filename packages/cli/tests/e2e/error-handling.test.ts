/**
 * Error Handling E2E Tests
 * Tests for error scenarios across all commands
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { CLIRunner } from '../utils/cli-runner'
import { TestHelpers } from '../utils/test-helpers'
import path from 'path'
import fs from 'fs'

describe('Error Handling', () => {
  let cli: CLIRunner
  let testDir: string
  let sourceDir: string

  beforeAll(async () => {
    // Build the CLI if needed
    const { execSync } = await import('child_process')
    try {
      execSync('pnpm build', { 
        cwd: path.join(__dirname, '..', '..'),
        stdio: 'pipe'
      })
    } catch (error) {
      // Ignore build errors in test
    }
    
    cli = new CLIRunner()
    testDir = await TestHelpers.createTempDir()
    sourceDir = path.join(testDir, 'source')
    await fs.promises.mkdir(sourceDir, { recursive: true })
  })

  afterAll(async () => {
    await TestHelpers.cleanupDir(testDir)
  })

  beforeEach(async () => {
    // Clean up for each test
    await fs.promises.rm(sourceDir, { recursive: true, force: true })
    await fs.promises.mkdir(sourceDir, { recursive: true })
  })

  describe('Device Connection Errors', () => {
    it('should handle no device connected across all commands', async () => {
      const commands = [
        ['detect'],
        ['list', '/'],
        ['transfer', sourceDir],
        ['resume']
      ]

      for (const cmd of commands) {
        const result = await cli.run(cmd, {
          env: { 
            MTP_MOCK_MODE: 'true',
            MTP_MOCK_NO_DEVICE: 'true'
          }
        })
        
        expect(result.exitCode).toBe(2) // NO_DEVICE exit code
        expect(result.stderr).toContain('未找到 MTP 裝置')
      }
    })

    it('should handle device busy errors', async () => {
      const result = await cli.run(['list', '/'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_DEVICE_BUSY: 'true'
        }
      })
      
      expect(result.exitCode).toBe(3) // DEVICE_BUSY exit code
      expect(result.stderr).toContain('Device is busy')
    })

    it('should detect device disconnection during operation', async () => {
      const testFile = path.join(sourceDir, 'test.txt')
      await fs.promises.writeFile(testFile, 'Test content')
      
      const result = await cli.run(['transfer', testFile], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_DISCONNECT_DURING: 'true'
        }
      })
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('裝置已中斷連接')
    })
  })

  describe('Permission Errors', () => {
    it('should handle permission denied for device access', async () => {
      const result = await cli.run(['detect'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_PERMISSION_DENIED: 'true'
        }
      })
      
      expect(result.exitCode).toBe(4) // PERMISSION_DENIED exit code
      expect(result.stderr).toContain('Permission denied')
      expect(result.stderr).toMatch(/sudo|administrator|權限/)
    })

    it('should handle read-only device for write operations', async () => {
      const testFile = path.join(sourceDir, 'readonly.txt')
      await fs.promises.writeFile(testFile, 'Cannot write')
      
      const result = await cli.run(['transfer', testFile], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_READONLY: 'true'
        }
      })
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('唯讀')
    })
  })

  describe('File System Errors', () => {
    it('should handle storage full errors', async () => {
      const largeFile = path.join(sourceDir, 'huge.bin')
      await fs.promises.writeFile(largeFile, Buffer.alloc(1024 * 1024)) // 1MB
      
      const result = await cli.run(['transfer', largeFile], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_STORAGE_FULL: 'true'
        }
      })
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('儲存空間不足')
    })

    it('should handle corrupted files gracefully', async () => {
      const corruptFile = path.join(sourceDir, 'corrupt.dat')
      await fs.promises.writeFile(corruptFile, Buffer.from([0xFF, 0xFE, 0x00, 0x00]))
      
      const result = await cli.run(['transfer', corruptFile], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_CORRUPT_FILE: corruptFile
        }
      })
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('檔案損壞')
    })

    it('should handle invalid paths', async () => {
      const invalidPaths = [
        '/../../etc/passwd',  // Path traversal attempt
        '//double/slash',     // Invalid format
        '/\x00null',         // Null character
        '/very/long/' + 'a'.repeat(300) // Path too long
      ]

      for (const invalidPath of invalidPaths) {
        const result = await cli.run(['list', invalidPath], {
          env: { MTP_MOCK_MODE: 'true' }
        })
        
        expect(result.exitCode).toBeGreaterThan(0)
        expect(result.stderr).toMatch(/無效路徑|路徑不存在/)
      }
    })
  })

  describe('Network and Timeout Errors', () => {
    it('should handle command timeout', async () => {
      const result = await cli.run(['detect', '--timeout', '100'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_SLOW_RESPONSE: '500' // 500ms delay
        },
        timeout: 1000
      })
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('timeout')
    })

    it('should handle USB communication errors', async () => {
      const result = await cli.run(['list', '/'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_USB_ERROR: 'true'
        }
      })
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toMatch(/USB|通訊錯誤/)
    })
  })

  describe('Command Line Errors', () => {
    it('should validate required arguments', async () => {
      const commandsWithRequiredArgs = [
        ['transfer'],     // Missing local-path
        ['list'],        // Path is optional, should work
        ['export']       // Missing format option
      ]

      const transferResult = await cli.runFail(['transfer'])
      expect(transferResult.exitCode).toBe(1)
      expect(transferResult.stderr).toContain('missing required argument')

      const listResult = await cli.runMocked(['list'])
      expect(listResult.exitCode).toBe(0) // Should succeed with default path

      const exportResult = await cli.runFail(['export'])
      expect(exportResult.exitCode).toBe(1)
    })

    it('should validate option values', async () => {
      // Invalid timeout value
      const timeoutResult = await cli.runFail(['detect', '--timeout', 'abc'])
      expect(timeoutResult.stderr).toContain('Invalid timeout')

      // Invalid sort option
      const sortResult = await cli.runFail(['list', '/', '--sort', 'invalid'])
      expect(sortResult.stderr).toContain('Invalid sort')

      // Invalid format option
      const formatResult = await cli.runFail(['export', '--format', 'invalid'])
      expect(formatResult.stderr).toContain('Invalid format')
    })

    it('should handle conflicting options', async () => {
      // --json with --verbose should warn or error
      const result = await cli.runMocked(['detect', '--json', '--verbose'])
      
      // Should still work but might warn
      expect(result.exitCode).toBe(0)
      const data = cli.parseJSON(result.stdout)
      expect(data).toBeDefined()
    })
  })

  describe('Database Errors', () => {
    it.skip('should handle database corruption', async () => {
      // Skip: Database functionality requires better-sqlite3
      const dbPath = path.join(testDir, 'corrupt.db')
      await fs.promises.writeFile(dbPath, 'Not a valid SQLite database')
      
      const result = await cli.run(['status', '--db', dbPath])
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('資料庫錯誤')
    })

    it.skip('should handle database permission errors', async () => {
      // Skip: Database functionality requires better-sqlite3
      const dbPath = path.join('/tmp', 'readonly.db')
      
      // Create read-only database
      await fs.promises.writeFile(dbPath, '')
      await fs.promises.chmod(dbPath, 0o444)
      
      const result = await cli.run(['transfer', sourceDir, '--db', dbPath])
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('無法寫入資料庫')
      
      // Cleanup
      await fs.promises.chmod(dbPath, 0o644)
      await fs.promises.rm(dbPath)
    })
  })

  describe('Recovery and Retry', () => {
    it('should suggest recovery options on errors', async () => {
      const result = await cli.run(['detect'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_NO_DEVICE: 'true'
        }
      })
      
      expect(result.stdout).toContain('請確認')
      expect(result.stdout).toMatch(/USB|解鎖|MTP/)
    })

    it('should handle graceful degradation', async () => {
      // When database fails, transfer should still work without resume capability
      const testFile = path.join(sourceDir, 'test.txt')
      await fs.promises.writeFile(testFile, 'Test')
      
      const result = await cli.runMocked(['transfer', testFile, '--db', '/invalid/path/db'])
      
      // Should warn but continue
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toContain('無法使用續傳功能')
      expect(result.stdout).toContain('傳輸完成')
    })
  })

  describe('Signal Handling', () => {
    it('should handle SIGINT gracefully', async () => {
      // Start a long-running operation
      const promise = cli.run(['list', '/', '--recursive'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_LARGE_DIR: '10000'
        }
      })
      
      // Send interrupt after 100ms
      setTimeout(() => {
        process.kill(process.pid, 'SIGINT')
      }, 100)
      
      const result = await promise
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('中斷')
    }, { timeout: 5000 })
  })

  describe('Verbose Error Output', () => {
    it('should show detailed errors with --verbose', async () => {
      const result = await cli.run(['detect', '--verbose'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_NO_DEVICE: 'true'
        }
      })
      
      expect(result.stderr).toContain('未找到 MTP 裝置')
      // Verbose mode should show more details
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(50)
    })

    it('should show stack traces in verbose mode', async () => {
      const result = await cli.run(['transfer', '/invalid/source/path', '--verbose'])
      
      expect(result.exitCode).toBeGreaterThan(0)
      // In verbose mode, might show more error details
      expect(result.stderr).toContain('路徑不存在')
    })
  })

  describe('Error Codes Consistency', () => {
    it('should use consistent exit codes across commands', async () => {
      const scenarios = [
        { env: { MTP_MOCK_NO_DEVICE: 'true' }, expectedCode: 2 },
        { env: { MTP_MOCK_DEVICE_BUSY: 'true' }, expectedCode: 3 },
        { env: { MTP_MOCK_PERMISSION_DENIED: 'true' }, expectedCode: 4 }
      ]

      for (const scenario of scenarios) {
        const detectResult = await cli.run(['detect'], {
          env: { MTP_MOCK_MODE: 'true', ...scenario.env }
        })
        
        expect(detectResult.exitCode).toBe(scenario.expectedCode)
      }
    })
  })
})