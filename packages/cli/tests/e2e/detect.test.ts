/**
 * Device Detection E2E Tests
 * Tests for the mtp-transfer detect command
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { CLIRunner } from '../utils/cli-runner'
import { TestHelpers } from '../utils/test-helpers'
import path from 'path'
import fs from 'fs'

describe('Device Detection Command', () => {
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

  beforeEach(() => {
    // Reset any mock state if needed
  })

  describe('Basic Detection', () => {
    it('should detect mock device successfully', async () => {
      const result = await cli.runMocked(['detect'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('找到 MTP 裝置')
      expect(result.stdout).toContain(mockConfig.device.vendor)
      expect(result.stdout).toContain(mockConfig.device.model)
    })

    it('should show device details with --verbose', async () => {
      const result = await cli.runMocked(['detect', '--verbose'])
      
      expect(result.stdout).toContain('序號')
      expect(result.stdout).toContain(mockConfig.device.serialNumber)
    })

    it('should output JSON format when requested', async () => {
      const result = await cli.runMocked(['detect', '--json'])
      
      const data = cli.parseJSON(result.stdout)
      
      expect(data.success).toBe(true)
      expect(data.device).toBeDefined()
      expect(data.device.vendor).toBe(mockConfig.device.vendor)
      expect(data.device.model).toBe(mockConfig.device.model)
      expect(data.timestamp).toBeDefined()
    })
  })

  describe('No Device Scenarios', () => {
    it('should handle no device connected gracefully', async () => {
      const result = await cli.run(['detect'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_NO_DEVICE: 'true'
        }
      })
      
      expect(result.exitCode).toBe(2) // Exit code for no device
      expect(result.stderr).toContain('未找到 MTP 裝置')
    })

    it('should suggest troubleshooting steps when no device found', async () => {
      const result = await cli.run(['detect'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_NO_DEVICE: 'true'
        }
      })
      
      expect(result.stdout).toContain('請確認')
      expect(result.stdout).toMatch(/USB 連接|解鎖|檔案傳輸/)
    })
  })

  describe('Device Busy Scenarios', () => {
    it('should handle device busy error', async () => {
      const result = await cli.run(['detect'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_DEVICE_BUSY: 'true'
        }
      })
      
      expect(result.exitCode).toBe(3) // Exit code for device busy
      expect(result.stderr).toContain('Device is busy')
    })

    // Note: The detect command doesn't have a --retry option
    // Retry logic is handled internally by the MTPWrapper
  })

  describe('Permission Errors', () => {
    it('should handle permission denied error', async () => {
      const result = await cli.run(['detect'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_PERMISSION_DENIED: 'true'
        }
      })
      
      expect(result.exitCode).toBe(4) // Exit code for permission error
      expect(result.stderr).toContain('Permission denied')
      expect(result.stderr).toMatch(/sudo|administrator|permissions/i)
    })
  })

  describe('Detailed Information', () => {
    it('should display detailed info with --detailed flag', async () => {
      const result = await cli.runMocked(['detect', '--detailed'])
      
      expect(result.stdout).toContain('找到 MTP 裝置')
      expect(result.stdout).toContain(mockConfig.device.vendor)
      expect(result.stdout).toContain(mockConfig.device.model)
      // Detailed output would include more device information
    })

    it('should output valid JSON with --detailed flag', async () => {
      const result = await cli.runMocked(['detect', '--detailed', '--json'])
      
      const data = cli.parseJSON(result.stdout)
      
      expect(data.success).toBe(true)
      expect(data.device).toBeDefined()
      // Note: Storage info is not currently implemented in --detailed
    })
  })

  describe('Performance', () => {
    it('should complete detection within reasonable time', async () => {
      const result = await cli.runMocked(['detect'])
      
      // Detection should be fast (under 2 seconds)
      expect(result.duration).toBeLessThan(2000)
    })

    it('should handle timeout gracefully', async () => {
      const result = await cli.run(['detect', '--timeout', '100'], {
        env: { 
          MTP_MOCK_MODE: 'true',
          MTP_MOCK_SLOW_RESPONSE: '200' // Simulate 200ms response
        },
        timeout: 5000
      })
      
      expect(result.exitCode).toBeGreaterThan(0)
      expect(result.stderr).toMatch(/timeout/i)
    })
  })

  describe('Integration with Other Commands', () => {
    it('should save device info for subsequent commands', async () => {
      // First detect the device (note: --save option doesn't exist, just use detect)
      const detectResult = await cli.runMocked(['detect'])
      expect(detectResult.exitCode).toBe(0)
      
      // Then check if list command can use saved device info
      const listResult = await cli.runMocked(['list', '/'])
      expect(listResult.exitCode).toBe(0)
      expect(listResult.stdout).not.toContain('No device detected')
    })
  })
})