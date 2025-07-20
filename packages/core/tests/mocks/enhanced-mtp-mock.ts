/**
 * Enhanced MTP Mock for E2E Testing
 * Supports environment variable based configuration
 */

import { MockCommandExecutor, MTP_MOCK_OUTPUTS } from './mtp-commands'
import fs from 'fs'
import path from 'path'

export class EnhancedMTPMock extends MockCommandExecutor {
  private mockConfigPath?: string

  constructor() {
    super()
    this.applyEnvironmentOverrides()
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentOverrides() {
    const env = process.env

    // Check for mock mode
    if (env.MTP_MOCK_MODE !== 'true') {
      return
    }

    // Load custom mock config if provided
    if (env.MTP_MOCK_CONFIG_PATH) {
      this.mockConfigPath = env.MTP_MOCK_CONFIG_PATH
      this.loadMockConfig()
    }

    // No device scenarios
    if (env.MTP_MOCK_NO_DEVICE === 'true') {
      this.setOutput('mtp-detect', MTP_MOCK_OUTPUTS.detectNoDevice)
      return
    }

    // Device busy scenarios
    if (env.MTP_MOCK_DEVICE_BUSY === 'true') {
      this.setShouldFail('mtp-detect', true)
      this.setOutput('mtp-detect', 'Error: Device is busy. Another application may be using the device.')
      return
    }

    // Device busy once (for retry testing)
    if (env.MTP_MOCK_DEVICE_BUSY_ONCE === 'true') {
      let attempts = 0
      const originalExecute = this.execute.bind(this)
      
      this.execute = async (command: string, args: string[]) => {
        if (command === 'mtp-detect' && attempts === 0) {
          attempts++
          return {
            success: false,
            output: 'Error: Device is busy',
            error: 'Device is busy',
            exitCode: 3,
            duration: 100
          }
        }
        return originalExecute(command, args)
      }
    }

    // Permission denied scenarios
    if (env.MTP_MOCK_PERMISSION_DENIED === 'true') {
      this.setShouldFail('mtp-detect', true)
      this.setOutput('mtp-detect', 'Error: Permission denied. Try running with sudo or as administrator.')
      return
    }

    // Slow response simulation
    if (env.MTP_MOCK_SLOW_RESPONSE) {
      const delay = parseInt(env.MTP_MOCK_SLOW_RESPONSE, 10)
      this.setDelay('mtp-detect', delay)
      this.setDelay('mtp-files', delay)
      this.setDelay('mtp-getfile', delay)
    }

    // Transfer failure simulation
    if (env.MTP_MOCK_TRANSFER_FAIL === 'true') {
      this.setShouldFail('mtp-getfile', true)
      this.setOutput('mtp-getfile', 'Error: Transfer failed - Connection interrupted')
    }

    // Custom device info
    if (env.MTP_MOCK_DEVICE_NAME) {
      const customOutput = MTP_MOCK_OUTPUTS.detectSuccess.replace(
        'Google Pixel 7 Pro',
        env.MTP_MOCK_DEVICE_NAME
      )
      this.setOutput('mtp-detect', customOutput)
    }
  }

  /**
   * Load mock configuration from file
   */
  private loadMockConfig() {
    if (!this.mockConfigPath || !fs.existsSync(this.mockConfigPath)) {
      return
    }

    try {
      const config = JSON.parse(fs.readFileSync(this.mockConfigPath, 'utf-8'))
      
      // Apply device configuration
      if (config.device) {
        const deviceOutput = this.createDeviceOutput(config.device)
        this.setOutput('mtp-detect', deviceOutput)
      }

      // Apply file list configuration
      if (config.files) {
        const filesOutput = this.createFilesOutput(config.files)
        this.setOutput('mtp-files', filesOutput)
      }

      // Apply transfer speeds
      if (config.transferSpeeds) {
        const speed = config.transferSpeeds[env.MTP_MOCK_TRANSFER_SPEED || 'default'] || config.transferSpeeds.default
        const delay = Math.floor(10485760 / speed * 1000) // 10MB file delay
        this.setDelay('mtp-getfile', delay)
      }

      // Apply error rates
      if (config.simulatedErrors) {
        this.applyErrorRates(config.simulatedErrors)
      }
    } catch (error) {
      console.error('Failed to load mock config:', error)
    }
  }

  /**
   * Create device detection output from config
   */
  private createDeviceOutput(device: any): string {
    return `libmtp version: 1.1.21

Listing raw device(s)
Device 0 (VID=18d1 and PID=4ee1) is a ${device.vendor} ${device.model}.
   Found 1 device(s):
   ${device.vendor}: ${device.model} (18d1:4ee1) @ bus 1, dev 21
Attempting to connect device(s)
Android device detected, assigning default bug flags
Device 0: ${device.model}
   Manufacturer: ${device.vendor}
   Model: ${device.model}
   Device version: ${device.version || '13'}
   Serial number: ${device.serialNumber}
   Device flags: 0x00000000
OK.`
  }

  /**
   * Create file listing output from config
   */
  private createFilesOutput(files: any[]): string {
    let output = 'Listing File Information on Device with name: Device\n'
    
    for (const file of files) {
      output += `File ID: ${file.id}
   Filename: ${file.name}
   File size: ${file.size} (0x${file.size.toString(16).padStart(8, '0')}) bytes
   Parent ID: ${file.parentId}
   Storage ID: 0x00010001
   Filetype: ${file.type === 'folder' ? 'Folder' : this.getFiletype(file.name)}

`
    }
    
    output += 'OK.'
    return output
  }

  /**
   * Get filetype from filename extension
   */
  private getFiletype(filename: string): string {
    const ext = path.extname(filename).toLowerCase()
    const typeMap: Record<string, string> = {
      '.jpg': 'JPEG file',
      '.jpeg': 'JPEG file',
      '.png': 'PNG file',
      '.mp4': 'MP4 file',
      '.mp3': 'MP3 file',
      '.pdf': 'PDF file',
      '.txt': 'Text file',
      '.doc': 'Word document',
      '.docx': 'Word document',
      '.xlsx': 'Excel file',
      '.zip': 'ZIP file'
    }
    
    return typeMap[ext] || 'Unknown file'
  }

  /**
   * Apply simulated error rates
   */
  private applyErrorRates(errorRates: any) {
    const env = process.env
    
    // Override with environment variables if set
    const transferFailureRate = parseFloat(env.MTP_MOCK_TRANSFER_FAIL_RATE || errorRates.transferFailureRate || '0')
    const connectionDropRate = parseFloat(env.MTP_MOCK_CONNECTION_DROP_RATE || errorRates.connectionDropRate || '0')
    const deviceBusyRate = parseFloat(env.MTP_MOCK_DEVICE_BUSY_RATE || errorRates.deviceBusyRate || '0')
    
    // Apply random failures based on rates
    if (Math.random() < transferFailureRate) {
      this.setShouldFail('mtp-getfile', true)
      this.setOutput('mtp-getfile', 'Error: Transfer failed')
    }
    
    if (Math.random() < connectionDropRate) {
      this.setShouldFail('mtp-detect', true)
      this.setOutput('mtp-detect', 'Error: Connection dropped')
    }
    
    if (Math.random() < deviceBusyRate) {
      this.setShouldFail('mtp-detect', true)
      this.setOutput('mtp-detect', 'Error: Device is busy')
    }
  }

  /**
   * Execute command with environment override support
   */
  async execute(command: string, args: string[] = []): Promise<{
    success: boolean
    output: string
    error?: string
    exitCode: number
    duration: number
  }> {
    // Re-apply environment overrides on each execution
    // This allows dynamic changes during tests
    this.applyEnvironmentOverrides()
    
    return super.execute(command, args)
  }
}

// Export singleton instance
export const enhancedMTPMock = new EnhancedMTPMock()

// Export environment variable helper
export const MTP_MOCK_ENV = {
  // Basic modes
  MOCK_MODE: 'MTP_MOCK_MODE',
  NO_DEVICE: 'MTP_MOCK_NO_DEVICE',
  DEVICE_BUSY: 'MTP_MOCK_DEVICE_BUSY',
  DEVICE_BUSY_ONCE: 'MTP_MOCK_DEVICE_BUSY_ONCE',
  PERMISSION_DENIED: 'MTP_MOCK_PERMISSION_DENIED',
  
  // Configuration
  CONFIG_PATH: 'MTP_MOCK_CONFIG_PATH',
  DEVICE_NAME: 'MTP_MOCK_DEVICE_NAME',
  
  // Performance
  SLOW_RESPONSE: 'MTP_MOCK_SLOW_RESPONSE',
  TRANSFER_SPEED: 'MTP_MOCK_TRANSFER_SPEED',
  
  // Errors
  TRANSFER_FAIL: 'MTP_MOCK_TRANSFER_FAIL',
  TRANSFER_FAIL_RATE: 'MTP_MOCK_TRANSFER_FAIL_RATE',
  CONNECTION_DROP_RATE: 'MTP_MOCK_CONNECTION_DROP_RATE',
  DEVICE_BUSY_RATE: 'MTP_MOCK_DEVICE_BUSY_RATE'
}