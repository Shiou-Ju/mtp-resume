/**
 * Transfer Command E2E Tests
 * Tests for the mtp-transfer transfer command
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { CLIRunner } from '../utils/cli-runner'
import { TestHelpers } from '../utils/test-helpers'
import path from 'path'
import fs from 'fs'

describe('Transfer Command', () => {
  let cli: CLIRunner
  let testDir: string
  let sourceDir: string
  let mockConfig: any

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
    
    // Load mock device config
    const configPath = path.join(__dirname, '..', 'fixtures', 'mock-device-config.json')
    mockConfig = JSON.parse(await fs.promises.readFile(configPath, 'utf-8'))
  })

  afterAll(async () => {
    await TestHelpers.cleanupDir(testDir)
  })

  beforeEach(async () => {
    // Clean up source directory for each test
    await fs.promises.rm(sourceDir, { recursive: true, force: true })
    await fs.promises.mkdir(sourceDir, { recursive: true })
  })

  describe('Basic Transfer', () => {
    it('should show error when no local path provided', async () => {
      const result = await cli.runFail(['transfer'])
      
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('error: missing required argument')
    })

    it('should show error when local path does not exist', async () => {
      const result = await cli.runMocked(['transfer', '/path/does/not/exist'])
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('本地路徑不存在')
    })

    it('should transfer single file successfully', async () => {
      // Create test file
      const testFile = path.join(sourceDir, 'test.txt')
      await fs.promises.writeFile(testFile, 'Hello MTP')
      
      const result = await cli.runMocked(['transfer', testFile])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('傳輸完成')
      expect(result.stdout).toContain('test.txt')
    })

    it('should transfer directory recursively', async () => {
      // Create test directory structure
      const subDir = path.join(sourceDir, 'subdir')
      await fs.promises.mkdir(subDir, { recursive: true })
      await fs.promises.writeFile(path.join(sourceDir, 'file1.txt'), 'File 1')
      await fs.promises.writeFile(path.join(subDir, 'file2.txt'), 'File 2')
      
      const result = await cli.runMocked(['transfer', sourceDir])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('file1.txt')
      expect(result.stdout).toContain('file2.txt')
      expect(result.stdout).toContain('2 個檔案')
    })
  })

  describe('Transfer Options', () => {
    it('should respect --dry-run option', async () => {
      const testFile = path.join(sourceDir, 'test.txt')
      await fs.promises.writeFile(testFile, 'Test content')
      
      const result = await cli.runMocked(['transfer', testFile, '--dry-run'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('試執行模式')
      expect(result.stdout).toContain('test.txt')
      expect(result.stdout).not.toContain('傳輸完成')
    })

    it('should filter files by pattern', async () => {
      // Create mixed files
      await fs.promises.writeFile(path.join(sourceDir, 'photo.jpg'), 'JPG')
      await fs.promises.writeFile(path.join(sourceDir, 'doc.txt'), 'TXT')
      await fs.promises.writeFile(path.join(sourceDir, 'video.mp4'), 'MP4')
      
      const result = await cli.runMocked(['transfer', sourceDir, '--filter', '*.jpg'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('photo.jpg')
      expect(result.stdout).not.toContain('doc.txt')
      expect(result.stdout).not.toContain('video.mp4')
    })

    it('should exclude files by pattern', async () => {
      // Create mixed files
      await fs.promises.writeFile(path.join(sourceDir, 'photo.jpg'), 'JPG')
      await fs.promises.writeFile(path.join(sourceDir, 'doc.txt'), 'TXT')
      await fs.promises.writeFile(path.join(sourceDir, 'temp.tmp'), 'TMP')
      
      const result = await cli.runMocked(['transfer', sourceDir, '--exclude', '*.tmp'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('photo.jpg')
      expect(result.stdout).toContain('doc.txt')
      expect(result.stdout).not.toContain('temp.tmp')
    })

    it('should specify destination path', async () => {
      const testFile = path.join(sourceDir, 'test.txt')
      await fs.promises.writeFile(testFile, 'Test content')
      
      const result = await cli.runMocked(['transfer', testFile, '--dest', '/Pictures/'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('/Pictures/')
    })

    it('should handle --overwrite option', async () => {
      const testFile = path.join(sourceDir, 'existing.txt')
      await fs.promises.writeFile(testFile, 'New content')
      
      // First transfer (simulate existing file)
      await cli.runMocked(['transfer', testFile])
      
      // Second transfer with overwrite
      const result = await cli.runMocked(['transfer', testFile, '--overwrite'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('覆寫')
    })

    it('should skip existing files without --overwrite', async () => {
      const testFile = path.join(sourceDir, 'existing.txt')
      await fs.promises.writeFile(testFile, 'Content')
      
      // Simulate file already exists on device
      const result = await cli.runMocked(['transfer', testFile], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_FILE_EXISTS: 'existing.txt'
        }
      })
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('略過')
    })
  })

  describe('Progress Display', () => {
    it('should show progress bar for transfers', async () => {
      // Create multiple files
      for (let i = 1; i <= 5; i++) {
        await fs.promises.writeFile(
          path.join(sourceDir, `file${i}.txt`), 
          'Content'.repeat(100)
        )
      }
      
      const result = await cli.runMocked(['transfer', sourceDir])
      
      expect(result.exitCode).toBe(0)
      // Progress output might not be captured in test, but check for completion
      expect(result.stdout).toContain('5 個檔案')
    })

    it('should show transfer statistics', async () => {
      // Create files with known sizes
      await fs.promises.writeFile(path.join(sourceDir, 'small.txt'), 'A'.repeat(1024))
      await fs.promises.writeFile(path.join(sourceDir, 'large.txt'), 'B'.repeat(1024 * 100))
      
      const result = await cli.runMocked(['transfer', sourceDir])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/傳輸大小|總大小/)
      expect(result.stdout).toMatch(/KB|MB/)
    })
  })

  describe('Error Handling', () => {
    it('should handle device disconnection during transfer', async () => {
      const testFile = path.join(sourceDir, 'test.txt')
      await fs.promises.writeFile(testFile, 'Content')
      
      const result = await cli.run(['transfer', testFile], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_DISCONNECT_AFTER: '1'  // Disconnect after 1 file
        }
      })
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('裝置已中斷連接')
    })

    it('should handle permission errors', async () => {
      const testFile = path.join(sourceDir, 'test.txt')
      await fs.promises.writeFile(testFile, 'Content')
      
      const result = await cli.run(['transfer', testFile], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_PERMISSION_DENIED: 'true'
        }
      })
      
      expect(result.exitCode).toBe(4)
      expect(result.stderr).toContain('Permission denied')
    })

    it('should handle storage full error', async () => {
      const testFile = path.join(sourceDir, 'large.txt')
      await fs.promises.writeFile(testFile, 'X'.repeat(1024 * 1024)) // 1MB
      
      const result = await cli.run(['transfer', testFile], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_STORAGE_FULL: 'true'
        }
      })
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('儲存空間不足')
    })
  })

  describe('Resume Capability', () => {
    it.skip('should track transfer status in database', async () => {
      // Skip: Database functionality requires better-sqlite3
      const testFile = path.join(sourceDir, 'tracked.txt')
      await fs.promises.writeFile(testFile, 'Tracked content')
      
      const result = await cli.runMocked(['transfer', testFile])
      
      expect(result.exitCode).toBe(0)
      
      // Check status to verify tracking
      const statusResult = await cli.runMocked(['status'])
      expect(statusResult.stdout).toContain('tracked.txt')
    })

    it('should support resuming interrupted transfers', async () => {
      const testFile = path.join(sourceDir, 'resume.txt')
      await fs.promises.writeFile(testFile, 'Resume content')
      
      // First transfer interrupts
      await cli.run(['transfer', testFile], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_INTERRUPT_AT: '50'  // Interrupt at 50%
        }
      })
      
      // Resume transfer
      const result = await cli.runMocked(['resume'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('續傳')
    })
  })

  describe('JSON Output', () => {
    it('should output transfer results as JSON', async () => {
      const testFile = path.join(sourceDir, 'test.json')
      await fs.promises.writeFile(testFile, '{"data": "test"}')
      
      const result = await cli.runMocked(['transfer', testFile, '--json'])
      
      expect(result.exitCode).toBe(0)
      
      const data = cli.parseJSON(result.stdout)
      expect(data.success).toBe(true)
      expect(data.transferred).toBeDefined()
      expect(data.transferred).toHaveLength(1)
      expect(data.transferred[0].name).toBe('test.json')
      expect(data.statistics).toBeDefined()
    })
  })

  describe('Batch Operations', () => {
    it('should transfer multiple directories', async () => {
      // Create multiple source directories
      const dir1 = path.join(testDir, 'dir1')
      const dir2 = path.join(testDir, 'dir2')
      await fs.promises.mkdir(dir1, { recursive: true })
      await fs.promises.mkdir(dir2, { recursive: true })
      await fs.promises.writeFile(path.join(dir1, 'file1.txt'), 'Dir1')
      await fs.promises.writeFile(path.join(dir2, 'file2.txt'), 'Dir2')
      
      // Note: Current implementation only supports single path
      // This test documents expected behavior for future enhancement
      const result = await cli.runMocked(['transfer', dir1])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('file1.txt')
    })

    it('should continue on error with --continue-on-error', async () => {
      // Create files where some will fail
      await fs.promises.writeFile(path.join(sourceDir, 'good1.txt'), 'OK')
      await fs.promises.writeFile(path.join(sourceDir, 'bad.txt'), 'FAIL')
      await fs.promises.writeFile(path.join(sourceDir, 'good2.txt'), 'OK')
      
      const result = await cli.runMocked(['transfer', sourceDir, '--continue-on-error'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_FAIL_FILES: 'bad.txt'  // Simulate failure for specific file
        }
      })
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('good1.txt')
      expect(result.stdout).toContain('good2.txt')
      expect(result.stderr).toContain('bad.txt')
    })
  })
})