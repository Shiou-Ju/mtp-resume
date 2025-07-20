/**
 * Resume Command E2E Tests
 * Tests for the mtp-transfer resume command
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { CLIRunner } from '../utils/cli-runner'
import { TestHelpers } from '../utils/test-helpers'
import path from 'path'
import fs from 'fs'

describe('Resume Command', () => {
  let cli: CLIRunner
  let testDir: string
  let sourceDir: string
  let dbPath: string

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
    dbPath = path.join(testDir, 'test-transfers.db')
    await fs.promises.mkdir(sourceDir, { recursive: true })
  })

  afterAll(async () => {
    await TestHelpers.cleanupDir(testDir)
  })

  beforeEach(async () => {
    // Clean up for each test
    await fs.promises.rm(sourceDir, { recursive: true, force: true })
    await fs.promises.mkdir(sourceDir, { recursive: true })
    
    // Remove test database
    await fs.promises.rm(dbPath, { force: true })
  })

  describe('Basic Resume', () => {
    it.skip('should show message when no pending transfers', async () => {
      // Skip: Database functionality requires better-sqlite3
      const result = await cli.runMocked(['resume', '--db', dbPath])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('沒有待續傳的檔案')
    })

    it('should resume interrupted transfer', async () => {
      // Create test file
      const testFile = path.join(sourceDir, 'interrupted.txt')
      await fs.promises.writeFile(testFile, 'X'.repeat(1024 * 100)) // 100KB
      
      // First transfer with interruption
      await cli.run(['transfer', testFile, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_INTERRUPT_AT: '50'  // Interrupt at 50%
        }
      })
      
      // Resume the transfer
      const result = await cli.runMocked(['resume', '--db', dbPath])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('續傳')
      expect(result.stdout).toContain('interrupted.txt')
      expect(result.stdout).toContain('完成')
    })

    it('should resume multiple pending transfers', async () => {
      // Create multiple files
      const files = ['file1.txt', 'file2.txt', 'file3.txt']
      for (const filename of files) {
        await fs.promises.writeFile(
          path.join(sourceDir, filename), 
          'Content for ' + filename
        )
      }
      
      // Transfer with interruption after first file
      await cli.run(['transfer', sourceDir, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_DISCONNECT_AFTER: '1'  // Disconnect after 1 file
        }
      })
      
      // Resume remaining transfers
      const result = await cli.runMocked(['resume', '--db', dbPath])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('2 個待續傳檔案')
      expect(result.stdout).toContain('file2.txt')
      expect(result.stdout).toContain('file3.txt')
    })
  })

  describe('Resume Options', () => {
    it('should support --dry-run for resume', async () => {
      // Setup interrupted transfer
      const testFile = path.join(sourceDir, 'test.txt')
      await fs.promises.writeFile(testFile, 'Test content')
      
      await cli.run(['transfer', testFile, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_INTERRUPT_AT: '50'
        }
      })
      
      // Dry run resume
      const result = await cli.runMocked(['resume', '--dry-run', '--db', dbPath])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('試執行模式')
      expect(result.stdout).toContain('test.txt')
      expect(result.stdout).not.toContain('傳輸完成')
    })

    it('should filter files to resume', async () => {
      // Create mixed files
      const files = ['photo1.jpg', 'photo2.jpg', 'document.pdf']
      for (const filename of files) {
        await fs.promises.writeFile(
          path.join(sourceDir, filename), 
          'Content'
        )
      }
      
      // Interrupt transfer
      await cli.run(['transfer', sourceDir, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_DISCONNECT_AFTER: '1'
        }
      })
      
      // Resume only JPG files
      const result = await cli.runMocked(['resume', '--filter', '*.jpg', '--db', dbPath])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('photo2.jpg')
      expect(result.stdout).not.toContain('document.pdf')
    })

    it('should limit number of files to resume', async () => {
      // Create many files
      for (let i = 1; i <= 10; i++) {
        await fs.promises.writeFile(
          path.join(sourceDir, `file${i}.txt`), 
          'Content'
        )
      }
      
      // Interrupt after 2 files
      await cli.run(['transfer', sourceDir, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_DISCONNECT_AFTER: '2'
        }
      })
      
      // Resume with limit
      const result = await cli.runMocked(['resume', '--limit', '5', '--db', dbPath])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('5 個檔案')
      expect(result.stdout).not.toContain('8 個檔案')
    })
  })

  describe('Resume Status', () => {
    it.skip('should show progress for partially transferred files', async () => {
      // Skip: Database functionality requires better-sqlite3
      const testFile = path.join(sourceDir, 'partial.txt')
      await fs.promises.writeFile(testFile, 'X'.repeat(1024 * 1024)) // 1MB
      
      // Interrupt at 30%
      await cli.run(['transfer', testFile, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_INTERRUPT_AT: '30'
        }
      })
      
      // Check status before resume
      const statusResult = await cli.runMocked(['status', '--db', dbPath])
      expect(statusResult.stdout).toContain('30%')
      
      // Resume and verify completion
      const result = await cli.runMocked(['resume', '--db', dbPath])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('70%') // Resuming remaining 70%
    })

    it('should handle files that were deleted after interruption', async () => {
      const testFile = path.join(sourceDir, 'deleted.txt')
      await fs.promises.writeFile(testFile, 'Will be deleted')
      
      // Interrupt transfer
      await cli.run(['transfer', testFile, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_INTERRUPT_AT: '50'
        }
      })
      
      // Delete the source file
      await fs.promises.rm(testFile)
      
      // Try to resume
      const result = await cli.run(['resume', '--db', dbPath])
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('來源檔案不存在')
      expect(result.stderr).toContain('deleted.txt')
    })
  })

  describe('Error Recovery', () => {
    it('should retry failed transfers', async () => {
      const testFile = path.join(sourceDir, 'retry.txt')
      await fs.promises.writeFile(testFile, 'Retry content')
      
      // First attempt fails
      await cli.run(['transfer', testFile, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_FAIL_FILES: 'retry.txt'
        }
      })
      
      // Resume with retry (should succeed this time)
      const result = await cli.runMocked(['resume', '--retry', '--db', dbPath])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('retry.txt')
      expect(result.stdout).toContain('成功')
    })

    it('should skip permanently failed files', async () => {
      // Create files
      await fs.promises.writeFile(path.join(sourceDir, 'good.txt'), 'OK')
      await fs.promises.writeFile(path.join(sourceDir, 'bad.txt'), 'FAIL')
      
      // Transfer with one permanent failure
      await cli.run(['transfer', sourceDir, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_PERMANENT_FAIL: 'bad.txt'
        }
      })
      
      // Resume should skip the permanently failed file
      const result = await cli.runMocked(['resume', '--skip-failed', '--db', dbPath])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('略過失敗檔案')
      expect(result.stdout).toContain('bad.txt')
    })

    it('should handle device disconnection during resume', async () => {
      // Setup multiple pending files
      for (let i = 1; i <= 5; i++) {
        await fs.promises.writeFile(
          path.join(sourceDir, `file${i}.txt`), 
          'Content'
        )
      }
      
      // Initial interrupted transfer
      await cli.run(['transfer', sourceDir, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_DISCONNECT_AFTER: '1'
        }
      })
      
      // Resume but disconnect again
      const result = await cli.run(['resume', '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_DISCONNECT_AFTER: '2'
        }
      })
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('裝置已中斷連接')
      // Should show that some files were resumed before disconnection
      expect(result.stdout).toMatch(/已續傳 \d+ 個檔案/)
    })
  })

  describe('Resume All', () => {
    it('should resume all pending transfers with --all flag', async () => {
      // Create files in different directories
      const dir1 = path.join(testDir, 'batch1')
      const dir2 = path.join(testDir, 'batch2')
      await fs.promises.mkdir(dir1, { recursive: true })
      await fs.promises.mkdir(dir2, { recursive: true })
      
      await fs.promises.writeFile(path.join(dir1, 'file1.txt'), 'Batch 1')
      await fs.promises.writeFile(path.join(dir2, 'file2.txt'), 'Batch 2')
      
      // Two separate interrupted transfers
      await cli.run(['transfer', dir1, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_INTERRUPT_AT: '50'
        }
      })
      
      await cli.run(['transfer', dir2, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_INTERRUPT_AT: '50'
        }
      })
      
      // Resume all
      const result = await cli.runMocked(['resume', '--all', '--db', dbPath])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('file1.txt')
      expect(result.stdout).toContain('file2.txt')
    })
  })

  describe('JSON Output', () => {
    it('should output resume results as JSON', async () => {
      const testFile = path.join(sourceDir, 'json-test.txt')
      await fs.promises.writeFile(testFile, 'JSON test')
      
      // Setup interrupted transfer
      await cli.run(['transfer', testFile, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_INTERRUPT_AT: '50'
        }
      })
      
      // Resume with JSON output
      const result = await cli.runMocked(['resume', '--json', '--db', dbPath])
      
      expect(result.exitCode).toBe(0)
      
      const data = cli.parseJSON(result.stdout)
      expect(data.success).toBe(true)
      expect(data.resumed).toBeDefined()
      expect(data.resumed).toHaveLength(1)
      expect(data.resumed[0].name).toBe('json-test.txt')
      expect(data.resumed[0].progress).toBeDefined()
      expect(data.statistics).toBeDefined()
    })
  })

  describe('Clear Failed', () => {
    it('should clear failed transfers from database', async () => {
      // Create a file that will fail
      const testFile = path.join(sourceDir, 'will-fail.txt')
      await fs.promises.writeFile(testFile, 'Fail')
      
      // Transfer with failure
      await cli.run(['transfer', testFile, '--db', dbPath], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_PERMANENT_FAIL: 'will-fail.txt'
        }
      })
      
      // Clear failed transfers
      const result = await cli.runMocked(['resume', '--clear-failed', '--db', dbPath])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('清除失敗記錄')
      expect(result.stdout).toContain('1 個失敗檔案已清除')
    })
  })
})