/**
 * Mock Handler for MTP Commands
 * This is included in the production build to support testing
 */

import fs from 'fs';

interface MockConfig {
  device?: any;
  files?: any[];
  transferSpeeds?: any;
  simulatedErrors?: any;
}

export class MockHandler {
  private config: MockConfig = {};

  constructor() {
    // Load config if provided
    const configPath = process.env.MTP_MOCK_CONFIG_PATH;
    if (configPath && fs.existsSync(configPath)) {
      try {
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (error) {
        console.error('Failed to load mock config:', error);
      }
    }
  }

  /**
   * Execute mock command
   */
  async execute(command: string, _args: string[]): Promise<{
    success: boolean;
    output: string;
    error?: string;
    exitCode: number;
    duration: number;
  }> {
    const startTime = Date.now();
    const env = process.env;

    // Simulate delay if configured
    const delay = parseInt(env.MTP_MOCK_SLOW_RESPONSE || '100', 10);
    await new Promise(resolve => setTimeout(resolve, delay));

    // Handle different scenarios based on environment variables
    if (env.MTP_MOCK_NO_DEVICE === 'true') {
      return {
        success: false,
        output: this.getNoDeviceOutput(),
        error: this.getNoDeviceOutput(),
        exitCode: 1,
        duration: Date.now() - startTime
      };
    }

    if (env.MTP_MOCK_DEVICE_BUSY === 'true') {
      return {
        success: false,
        output: '',
        error: 'Error: Device is busy. Another application may be using the device.',
        exitCode: 3,
        duration: Date.now() - startTime
      };
    }

    if (env.MTP_MOCK_PERMISSION_DENIED === 'true') {
      return {
        success: false,
        output: '',
        error: 'Error: Permission denied. Try running with sudo or as administrator.',
        exitCode: 4,
        duration: Date.now() - startTime
      };
    }

    // Default success case
    switch (command) {
      case 'mtp-detect':
        return {
          success: true,
          output: this.getDetectOutput(),
          exitCode: 0,
          duration: Date.now() - startTime
        };
      
      case 'mtp-files':
        return {
          success: true,
          output: this.getFilesOutput(),
          exitCode: 0,
          duration: Date.now() - startTime
        };
      
      case 'mtp-getfile':
        return {
          success: true,
          output: this.getGetFileOutput(),
          exitCode: 0,
          duration: Date.now() - startTime
        };
      
      default:
        return {
          success: false,
          output: '',
          error: `Unknown command: ${command}`,
          exitCode: 1,
          duration: Date.now() - startTime
        };
    }
  }

  private getNoDeviceOutput(): string {
    return `libmtp version: 1.1.21

Listing raw device(s)
   No raw devices found.`;
  }

  private getDetectOutput(): string {
    const device = this.config.device || {
      vendor: 'Google Inc.',
      model: 'Pixel 7 Pro',
      serialNumber: 'TEST1234567890',
      version: '13'
    };

    // Check for custom device name from env
    if (process.env.MTP_MOCK_DEVICE_NAME) {
      device.model = process.env.MTP_MOCK_DEVICE_NAME;
    }

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
   Device version: ${device.version}
   Serial number: ${device.serialNumber}
   Device flags: 0x00000000
OK.`;
  }

  private getFilesOutput(): string {
    const files = this.config.files || [
      { id: 1, name: 'DCIM', type: 'folder', size: 0, parentId: 0 },
      { id: 100, name: 'IMG_20240101_120000.jpg', type: 'file', size: 2097152, parentId: 1 }
    ];

    let output = 'Listing File Information on Device with name: Device\n';
    
    for (const file of files) {
      output += `File ID: ${file.id}
   Filename: ${file.name}
   File size: ${file.size} (0x${file.size.toString(16).padStart(8, '0')}) bytes
   Parent ID: ${file.parentId}
   Storage ID: 0x00010001
   Filetype: ${file.type === 'folder' ? 'Folder' : 'JPEG file'}

`;
    }
    
    output += 'OK.';
    return output;
  }

  private getGetFileOutput(): string {
    return `Getting file with ID: 100
Progress: 100%
File transfer complete.`;
  }
}

// Export singleton instance
export const mockHandler = new MockHandler();