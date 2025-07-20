/**
 * List Command E2E Tests
 * Tests for the mtp-transfer list command
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { CLIRunner } from '../utils/cli-runner'
import { TestHelpers } from '../utils/test-helpers'
import path from 'path'
import fs from 'fs'

describe('List Command', () => {
  let cli: CLIRunner
  let testDir: string
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
    
    // Load mock device config
    const configPath = path.join(__dirname, '..', 'fixtures', 'mock-device-config.json')
    mockConfig = JSON.parse(await fs.promises.readFile(configPath, 'utf-8'))
  })

  afterAll(async () => {
    await TestHelpers.cleanupDir(testDir)
  })

  describe('Basic Listing', () => {
    it('should list root directory when no path provided', async () => {
      const result = await cli.runMocked(['list'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('/')
      // Should show directories from mock config
      expect(result.stdout).toContain('DCIM')
      expect(result.stdout).toContain('Pictures')
      expect(result.stdout).toContain('Music')
    })

    it('should list specific directory', async () => {
      const result = await cli.runMocked(['list', '/DCIM'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Camera')
      expect(result.stdout).toContain('Screenshots')
    })

    it('should show error for non-existent path', async () => {
      const result = await cli.run(['list', '/NonExistent'], {
        env: { MTP_MOCK_MODE: 'true' }
      })
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toContain('路徑不存在')
    })
  })

  describe('File Information Display', () => {
    it('should show file sizes in human-readable format', async () => {
      const result = await cli.runMocked(['list', '/DCIM/Camera'])
      
      expect(result.exitCode).toBe(0)
      // Check for size units
      expect(result.stdout).toMatch(/\d+(\.\d+)?\s*(B|KB|MB|GB)/)
      expect(result.stdout).toContain('IMG_')
    })

    it('should show file count and total size', async () => {
      const result = await cli.runMocked(['list', '/DCIM/Camera'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/共 \d+ 個項目/)
      expect(result.stdout).toMatch(/總大小: \d+(\.\d+)?\s*(B|KB|MB|GB)/)
    })

    it('should display file types with icons', async () => {
      const result = await cli.runMocked(['list', '/Pictures'])
      
      expect(result.exitCode).toBe(0)
      // Check for file type indicators
      expect(result.stdout).toContain('📁') // Directory icon
      expect(result.stdout).toContain('.jpg')
      expect(result.stdout).toContain('.png')
    })
  })

  describe('Listing Options', () => {
    it('should list recursively with --recursive', async () => {
      const result = await cli.runMocked(['list', '/DCIM', '--recursive'])
      
      expect(result.exitCode).toBe(0)
      // Should show nested structure
      expect(result.stdout).toContain('/DCIM/Camera')
      expect(result.stdout).toContain('IMG_0001.jpg')
      expect(result.stdout).toContain('/DCIM/Screenshots')
    })

    it('should filter by pattern with --filter', async () => {
      const result = await cli.runMocked(['list', '/DCIM/Camera', '--filter', '*.jpg'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('.jpg')
      expect(result.stdout).not.toContain('.mp4')
    })

    it('should sort files with --sort option', async () => {
      // Sort by size
      const sizeResult = await cli.runMocked(['list', '/DCIM/Camera', '--sort', 'size'])
      expect(sizeResult.exitCode).toBe(0)
      
      // Sort by date
      const dateResult = await cli.runMocked(['list', '/DCIM/Camera', '--sort', 'date'])
      expect(dateResult.exitCode).toBe(0)
      
      // Sort by name (default)
      const nameResult = await cli.runMocked(['list', '/DCIM/Camera', '--sort', 'name'])
      expect(nameResult.exitCode).toBe(0)
    })

    it('should show detailed info with --long', async () => {
      const result = await cli.runMocked(['list', '/DCIM/Camera', '--long'])
      
      expect(result.exitCode).toBe(0)
      // Long format includes permissions, date, etc.
      expect(result.stdout).toMatch(/\d{4}-\d{2}-\d{2}/) // Date format
      expect(result.stdout).toContain('IMG_0001.jpg')
      // Check for file ID in long format
      expect(result.stdout).toMatch(/ID: \d+/)
    })

    it('should limit results with --limit', async () => {
      const result = await cli.runMocked(['list', '/DCIM/Camera', '--limit', '5'])
      
      expect(result.exitCode).toBe(0)
      // Should only show 5 items
      const lines = result.stdout.split('\n').filter(line => line.includes('IMG_'))
      expect(lines.length).toBeLessThanOrEqual(5)
    })
  })

  describe('Tree Display', () => {
    it('should display as tree with --tree option', async () => {
      const result = await cli.runMocked(['list', '/', '--tree'])
      
      expect(result.exitCode).toBe(0)
      // Tree format indicators
      expect(result.stdout).toMatch(/[├│└─]/)
      expect(result.stdout).toContain('DCIM')
      expect(result.stdout).toContain('Pictures')
    })

    it('should limit tree depth with --depth', async () => {
      const result = await cli.runMocked(['list', '/', '--tree', '--depth', '1'])
      
      expect(result.exitCode).toBe(0)
      // Should only show first level
      expect(result.stdout).toContain('DCIM')
      expect(result.stdout).not.toContain('Camera') // Nested folder
    })
  })

  describe('JSON Output', () => {
    it('should output listing as JSON', async () => {
      const result = await cli.runMocked(['list', '/DCIM', '--json'])
      
      expect(result.exitCode).toBe(0)
      
      const data = cli.parseJSON(result.stdout)
      expect(data.success).toBe(true)
      expect(data.path).toBe('/DCIM')
      expect(data.items).toBeDefined()
      expect(Array.isArray(data.items)).toBe(true)
      
      // Check item structure
      const item = data.items[0]
      expect(item).toHaveProperty('name')
      expect(item).toHaveProperty('type')
      expect(item).toHaveProperty('size')
      expect(item).toHaveProperty('modified')
    })

    it('should include full paths in JSON with --full-path', async () => {
      const result = await cli.runMocked(['list', '/DCIM', '--json', '--full-path'])
      
      const data = cli.parseJSON(result.stdout)
      expect(data.items[0].path).toContain('/DCIM/')
    })
  })

  describe('Special Directories', () => {
    it('should handle root directory listing', async () => {
      const result = await cli.runMocked(['list', '/'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('DCIM')
      expect(result.stdout).toContain('Pictures')
      expect(result.stdout).toContain('Music')
      expect(result.stdout).toContain('Documents')
    })

    it('should handle empty directories', async () => {
      const result = await cli.runMocked(['list', '/EmptyDir'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_EMPTY_DIR: '/EmptyDir'
        }
      })
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('空目錄')
    })

    it('should handle directories with special characters', async () => {
      const result = await cli.runMocked(['list', '/Pictures/相片 2024'])
      
      expect(result.exitCode).toBe(0)
      // Should handle Chinese characters properly
    })
  })

  describe('Performance', () => {
    it('should handle large directories efficiently', async () => {
      const result = await cli.runMocked(['list', '/LargeDir'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_LARGE_DIR: '1000' // Simulate 1000 files
        }
      })
      
      expect(result.exitCode).toBe(0)
      expect(result.duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should paginate results for very large listings', async () => {
      const result = await cli.runMocked(['list', '/VeryLargeDir', '--page', '1', '--page-size', '50'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_LARGE_DIR: '5000'
        }
      })
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('第 1 頁')
      expect(result.stdout).toContain('共 100 頁') // 5000 / 50 = 100 pages
    })
  })

  describe('Export Functionality', () => {
    it('should export listing to file with --export', async () => {
      const exportPath = path.join(testDir, 'listing.txt')
      
      const result = await cli.runMocked(['list', '/DCIM', '--export', exportPath])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('匯出至')
      
      // Verify file was created
      const content = await fs.promises.readFile(exportPath, 'utf-8')
      expect(content).toContain('Camera')
    })

    it('should export as CSV with --export-format csv', async () => {
      const exportPath = path.join(testDir, 'listing.csv')
      
      const result = await cli.runMocked(['list', '/DCIM', '--export', exportPath, '--export-format', 'csv'])
      
      expect(result.exitCode).toBe(0)
      
      const content = await fs.promises.readFile(exportPath, 'utf-8')
      expect(content).toContain('name,type,size,modified') // CSV headers
    })
  })

  describe('Error Handling', () => {
    it('should handle device disconnection gracefully', async () => {
      const result = await cli.run(['list', '/DCIM'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_NO_DEVICE: 'true'
        }
      })
      
      expect(result.exitCode).toBe(2)
      expect(result.stderr).toContain('未找到 MTP 裝置')
    })

    it('should handle permission errors', async () => {
      const result = await cli.run(['list', '/System'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_PERMISSION_DENIED: 'true'
        }
      })
      
      expect(result.exitCode).toBe(4)
      expect(result.stderr).toContain('Permission denied')
    })
  })
})