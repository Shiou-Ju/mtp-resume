/**
 * Test Helper Utilities for E2E Testing
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

export class TestHelpers {
  /**
   * Create a temporary directory for testing
   */
  static async createTempDir(prefix: string = 'mtp-test-'): Promise<string> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix))
    return tempDir
  }

  /**
   * Clean up a directory and its contents
   */
  static async cleanupDir(dir: string): Promise<void> {
    try {
      await fs.promises.rm(dir, { recursive: true, force: true })
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  /**
   * Create test files with specific sizes
   */
  static async createTestFile(
    filePath: string, 
    size: number, 
    pattern: 'random' | 'zeros' | 'pattern' = 'random'
  ): Promise<void> {
    const dir = path.dirname(filePath)
    await fs.promises.mkdir(dir, { recursive: true })

    let buffer: Buffer

    switch (pattern) {
      case 'zeros':
        buffer = Buffer.alloc(size)
        break
      case 'pattern':
        // Create repeating pattern
        const patternData = Buffer.from('MTP_TEST_PATTERN')
        buffer = Buffer.alloc(size)
        for (let i = 0; i < size; i += patternData.length) {
          patternData.copy(buffer, i)
        }
        break
      case 'random':
      default:
        buffer = crypto.randomBytes(size)
        break
    }

    await fs.promises.writeFile(filePath, buffer)
  }

  /**
   * Create a set of test files
   */
  static async createTestFileSet(baseDir: string): Promise<string[]> {
    const files = [
      { name: 'small.txt', size: 1024 },              // 1KB
      { name: 'medium.jpg', size: 1024 * 1024 },      // 1MB
      { name: 'large.mp4', size: 10 * 1024 * 1024 },  // 10MB
      { name: 'docs/report.pdf', size: 512 * 1024 },  // 512KB
      { name: 'docs/readme.txt', size: 2048 },        // 2KB
      { name: 'photos/IMG_001.jpg', size: 2 * 1024 * 1024 }, // 2MB
      { name: 'photos/IMG_002.jpg', size: 3 * 1024 * 1024 }, // 3MB
    ]

    const createdFiles: string[] = []

    for (const file of files) {
      const filePath = path.join(baseDir, file.name)
      await this.createTestFile(filePath, file.size, 'pattern')
      createdFiles.push(filePath)
    }

    return createdFiles
  }

  /**
   * Calculate file checksum
   */
  static async getFileChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    
    return new Promise((resolve, reject) => {
      stream.on('data', (data) => hash.update(data))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  /**
   * Verify file integrity
   */
  static async verifyFileIntegrity(
    sourcePath: string, 
    destPath: string
  ): Promise<boolean> {
    const [sourceHash, destHash] = await Promise.all([
      this.getFileChecksum(sourcePath),
      this.getFileChecksum(destPath)
    ])
    
    return sourceHash === destHash
  }

  /**
   * Wait for a condition to be true
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now()
    
    while (true) {
      const result = await condition()
      if (result) {
        return
      }
      
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for condition')
      }
      
      await new Promise(resolve => setTimeout(resolve, interval))
    }
  }

  /**
   * Create mock device structure
   */
  static async createMockDeviceStructure(baseDir: string): Promise<void> {
    const deviceDirs = [
      'DCIM/Camera',
      'Pictures',
      'Downloads',
      'Music',
      'Documents',
      'WhatsApp/Media/WhatsApp Images',
      'WhatsApp/Media/WhatsApp Documents'
    ]

    for (const dir of deviceDirs) {
      await fs.promises.mkdir(path.join(baseDir, dir), { recursive: true })
    }

    // Add some sample files
    await this.createTestFile(
      path.join(baseDir, 'DCIM/Camera/IMG_20240101_120000.jpg'),
      2 * 1024 * 1024,
      'pattern'
    )
    
    await this.createTestFile(
      path.join(baseDir, 'Downloads/document.pdf'),
      512 * 1024,
      'pattern'
    )
  }

  /**
   * Generate test database path
   */
  static getTestDbPath(testName: string): string {
    return path.join(os.tmpdir(), `mtp-test-${testName}-${Date.now()}.db`)
  }

  /**
   * Sleep for specified milliseconds
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Extract ANSI-free text from output
   */
  static stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\u001b\[[0-9;]*m/g, '')
  }
}