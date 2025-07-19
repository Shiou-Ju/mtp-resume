/**
 * @fileoverview MTPWrapper Module Unit Tests
 * @description Tests for MTP device operations wrapper
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MTPWrapper } from '../../src/mtp-wrapper'
import { MockCommandExecutor, MTP_MOCK_OUTPUTS } from '../mocks/mtp-commands'
import type { MTPWrapperOptions } from '../../src/mtp-wrapper'

// Mock the command-runner module
vi.mock('../../src/utils/command-runner', () => {
  const mockExecutor = new MockCommandExecutor()
  return {
    CommandRunner: class {
      async executeCommand(command: string, args: string[]) {
        return mockExecutor.execute(command, args)
      }
    },
    mockExecutor // Export for test access
  }
})

describe('MTPWrapper', () => {
  let mtp: MTPWrapper
  let mockExecutor: MockCommandExecutor

  beforeEach(async () => {
    // Get mock executor instance
    const mod = await import('../../src/utils/command-runner')
    mockExecutor = (mod as any).mockExecutor
    mockExecutor.reset()
    
    mtp = new MTPWrapper()
  })

  describe('Device Detection', () => {
    it('should detect connected device', async () => {
      mockExecutor.setOutput('mtp-detect', MTP_MOCK_OUTPUTS.detectSuccess)
      
      const device = await mtp.detectDevice()
      
      expect(device).toBeDefined()
      expect(device?.vendor).toBe('Google Inc.')
      expect(device?.model).toBe('Pixel 7 Pro')
      expect(device?.serialNumber).toBe('1234567890ABCDEF')
      expect(device?.connected).toBe(true)
    })

    it('should return null when no device found', async () => {
      mockExecutor.setOutput('mtp-detect', MTP_MOCK_OUTPUTS.detectNoDevice)
      
      const device = await mtp.detectDevice()
      
      expect(device).toBeNull()
    })

    it('should handle detection errors', async () => {
      mockExecutor.setShouldFail('mtp-detect', true)
      
      await expect(mtp.detectDevice()).rejects.toThrow()
    })

    it('should check device connection status', async () => {
      mockExecutor.setOutput('mtp-detect', MTP_MOCK_OUTPUTS.detectSuccess)
      
      const isConnected = await mtp.isDeviceConnected()
      expect(isConnected).toBe(true)
      
      mockExecutor.setOutput('mtp-detect', MTP_MOCK_OUTPUTS.detectNoDevice)
      const isConnected2 = await mtp.isDeviceConnected()
      expect(isConnected2).toBe(false)
    })
  })

  describe('File Listing', () => {
    beforeEach(() => {
      // Ensure device is connected for file operations
      mockExecutor.setOutput('mtp-detect', MTP_MOCK_OUTPUTS.detectSuccess)
    })

    it('should list files in root directory', async () => {
      mockExecutor.setOutput('mtp-files', MTP_MOCK_OUTPUTS.filesBasic)
      
      const files = await mtp.listFiles('/')
      
      expect(files).toHaveLength(4)
      expect(files[0].name).toBe('DCIM')
      expect(files[0].type).toBe('folder')
      expect(files[2].name).toBe('IMG_20240101_120000.jpg')
      expect(files[2].size).toBe(2097152)
      expect(files[2].type).toBe('file')
    })

    it('should list files recursively', async () => {
      mockExecutor.setOutput('mtp-files', MTP_MOCK_OUTPUTS.filesRecursive)
      
      const files = await mtp.listFiles('/', { recursive: true })
      
      expect(files).toHaveLength(5)
      const cameraFolder = files.find(f => f.name === 'Camera')
      expect(cameraFolder).toBeDefined()
      expect(cameraFolder?.parentId).toBe(1)
    })

    it('should handle empty directory', async () => {
      mockExecutor.setOutput('mtp-files', MTP_MOCK_OUTPUTS.filesEmpty)
      
      const files = await mtp.listFiles('/')
      
      expect(files).toHaveLength(0)
    })

    it('should throw error when device not connected', async () => {
      mockExecutor.setOutput('mtp-detect', MTP_MOCK_OUTPUTS.detectNoDevice)
      
      await expect(mtp.listFiles('/')).rejects.toThrow('No MTP device connected')
    })
  })

  describe('File Download', () => {
    beforeEach(() => {
      mockExecutor.setOutput('mtp-detect', MTP_MOCK_OUTPUTS.detectSuccess)
    })

    it('should download file successfully', async () => {
      const progressUpdates: number[] = []
      
      const result = await mtp.downloadFile(100, './test.jpg', {
        onProgress: (progress) => {
          progressUpdates.push(progress.percentage)
        }
      })
      
      expect(result.success).toBe(true)
      expect(result.filePath).toBe('./test.jpg')
    })

    it('should handle download errors', async () => {
      mockExecutor.setOutput('mtp-getfile', MTP_MOCK_OUTPUTS.getFileError)
      mockExecutor.setShouldFail('mtp-getfile', true)
      
      await expect(
        mtp.downloadFile(999, './test.jpg')
      ).rejects.toThrow()
    })

    it('should create directories if needed', async () => {
      const result = await mtp.downloadFile(100, './new/dir/test.jpg', {
        createDirectories: true
      })
      
      expect(result.success).toBe(true)
    })
  })

  describe('Device Info', () => {
    it('should get detailed device info', async () => {
      mockExecutor.setOutput('mtp-detect', MTP_MOCK_OUTPUTS.detectSuccess)
      
      const info = await mtp.getDeviceInfo()
      
      expect(info).toBeDefined()
      expect(info?.device.model).toBe('Pixel 7 Pro')
      // Storage info would be parsed from additional commands
    })

    it('should handle device info errors gracefully', async () => {
      mockExecutor.setOutput('mtp-detect', MTP_MOCK_OUTPUTS.detectNoDevice)
      
      const info = await mtp.getDeviceInfo()
      
      expect(info).toBeNull()
    })
  })

  describe('Options and Configuration', () => {
    it('should respect timeout option', async () => {
      const shortTimeout = new MTPWrapper({ timeout: 100 })
      mockExecutor.setDelay('mtp-detect', 200)
      
      // This should timeout
      await expect(shortTimeout.detectDevice()).rejects.toThrow()
    })

    it('should retry on failure', async () => {
      const withRetry = new MTPWrapper({ retries: 2 })
      let attempts = 0
      
      mockExecutor.setShouldFail('mtp-detect', true)
      
      // Mock to fail first, succeed second
      const originalExecute = mockExecutor.execute.bind(mockExecutor)
      mockExecutor.execute = vi.fn(async (cmd, args) => {
        attempts++
        if (attempts === 2) {
          mockExecutor.setShouldFail('mtp-detect', false)
          mockExecutor.setOutput('mtp-detect', MTP_MOCK_OUTPUTS.detectSuccess)
        }
        return originalExecute(cmd, args)
      })
      
      const device = await withRetry.detectDevice()
      expect(device).toBeDefined()
      expect(attempts).toBe(2)
    })

    it('should enable debug logging', async () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const withDebug = new MTPWrapper({ debug: true })
      
      await withDebug.detectDevice()
      
      expect(debugSpy).toHaveBeenCalled()
      debugSpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('should handle command not found', async () => {
      mockExecutor.setOutput('mtp-detect', 'mtp-detect: command not found')
      mockExecutor.setShouldFail('mtp-detect', true)
      
      await expect(mtp.detectDevice()).rejects.toThrow()
    })

    it('should handle permission errors', async () => {
      mockExecutor.setOutput('mtp-detect', 'Error: Permission denied')
      mockExecutor.setShouldFail('mtp-detect', true)
      
      await expect(mtp.detectDevice()).rejects.toThrow()
    })

    it('should handle device busy errors', async () => {
      mockExecutor.setOutput('mtp-detect', 'Error: Device is busy')
      mockExecutor.setShouldFail('mtp-detect', true)
      
      await expect(mtp.detectDevice()).rejects.toThrow()
    })
  })
})