/**
 * @fileoverview MTP Commands Mock
 * @description Mock implementations for MTP command-line tools
 */

export const MTP_MOCK_OUTPUTS = {
  // mtp-detect output
  detectSuccess: `libmtp version: 1.1.21

Listing raw device(s)
Device 0 (VID=18d1 and PID=4ee1) is a Google Inc (for LG Electronics/Samsung) Nexus 4/5/7/10 (MTP).
   Found 1 device(s):
   Google Inc (for LG Electronics/Samsung): Nexus 4/5/7/10 (MTP) (18d1:4ee1) @ bus 1, dev 21
Attempting to connect device(s)
Android device detected, assigning default bug flags
Device 0: Google Pixel 7 Pro
   Manufacturer: Google Inc.
   Model: Pixel 7 Pro
   Device version: 13
   Serial number: 1234567890ABCDEF
   Device flags: 0x00000000
OK.`,

  detectNoDevice: `libmtp version: 1.1.21

Listing raw device(s)
   No raw devices found.`,

  detectError: `libmtp version: 1.1.21
Error: Unable to initialize libmtp`,

  // mtp-files output
  filesBasic: `Listing File Information on Device with name: Google Pixel 7 Pro
File ID: 1
   Filename: DCIM
   File size: 0 (0x00000000) bytes
   Parent ID: 0
   Storage ID: 0x00010001
   Filetype: Folder

File ID: 2
   Filename: Pictures
   File size: 0 (0x00000000) bytes
   Parent ID: 0
   Storage ID: 0x00010001
   Filetype: Folder

File ID: 100
   Filename: IMG_20240101_120000.jpg
   File size: 2097152 (0x00200000) bytes
   Parent ID: 1
   Storage ID: 0x00010001
   Filetype: JPEG file

File ID: 101
   Filename: VID_20240102_150000.mp4
   File size: 10485760 (0x00A00000) bytes
   Parent ID: 1
   Storage ID: 0x00010001
   Filetype: MP4 file

OK.`,

  filesEmpty: `Listing File Information on Device with name: Google Pixel 7 Pro
OK.`,

  filesRecursive: `Listing File Information on Device with name: Google Pixel 7 Pro
File ID: 1
   Filename: DCIM
   File size: 0 (0x00000000) bytes
   Parent ID: 0
   Storage ID: 0x00010001
   Filetype: Folder

File ID: 10
   Filename: Camera
   File size: 0 (0x00000000) bytes
   Parent ID: 1
   Storage ID: 0x00010001
   Filetype: Folder

File ID: 100
   Filename: IMG_20240101_120000.jpg
   File size: 2097152 (0x00200000) bytes
   Parent ID: 10
   Storage ID: 0x00010001
   Filetype: JPEG file

File ID: 101
   Filename: IMG_20240101_130000.jpg
   File size: 2097152 (0x00200000) bytes
   Parent ID: 10
   Storage ID: 0x00010001
   Filetype: JPEG file

OK.`,

  // mtp-getfile output
  getFileSuccess: `Getting file with ID: 100
Progress: 100%
File transfer complete.`,

  getFileError: `Getting file with ID: 999
Error: File not found`,

  getFileProgress: (percent: number) => `Getting file with ID: 100
Progress: ${percent}%`,
}

/**
 * Mock command executor
 */
export class MockCommandExecutor {
  private outputs: Map<string, string> = new Map()
  public delays: Map<string, number> = new Map()
  private shouldFail: Map<string, boolean> = new Map()

  constructor() {
    this.setupDefaults()
  }

  private setupDefaults() {
    // Set default outputs
    this.outputs.set('mtp-detect', MTP_MOCK_OUTPUTS.detectSuccess)
    this.outputs.set('mtp-files', MTP_MOCK_OUTPUTS.filesBasic)
    this.outputs.set('mtp-getfile', MTP_MOCK_OUTPUTS.getFileSuccess)
    
    // Set default delays (ms)
    this.delays.set('mtp-detect', 100)
    this.delays.set('mtp-files', 50)
    this.delays.set('mtp-getfile', 200)
  }

  /**
   * Set mock output for a command
   */
  setOutput(command: string, output: string) {
    this.outputs.set(command, output)
  }

  /**
   * Set delay for a command
   */
  setDelay(command: string, delay: number) {
    this.delays.set(command, delay)
  }

  /**
   * Set command to fail
   */
  setShouldFail(command: string, shouldFail: boolean) {
    this.shouldFail.set(command, shouldFail)
  }

  /**
   * Execute mock command
   */
  async execute(command: string, args: string[] = []): Promise<{
    success: boolean
    output: string
    error?: string
    exitCode: number
    duration: number
  }> {
    const startTime = Date.now()
    const delay = this.delays.get(command) || 0
    
    // Simulate command execution delay
    await new Promise(resolve => setTimeout(resolve, delay))
    
    const shouldFail = this.shouldFail.get(command) || false
    const output = this.outputs.get(command) || ''
    
    const duration = Date.now() - startTime
    
    if (shouldFail) {
      const errorOutput = this.outputs.get(command) || '';
      return {
        success: false,
        output: errorOutput,
        error: errorOutput || `Command '${command}' failed`,
        exitCode: 1,
        duration
      }
    }
    
    return {
      success: true,
      output,
      exitCode: 0,
      duration
    }
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.outputs.clear()
    this.delays.clear()
    this.shouldFail.clear()
    this.setupDefaults()
  }
}

/**
 * Mock MTP device state
 */
export class MockMTPDevice {
  public connected: boolean = true
  public files: Map<number, any> = new Map()
  
  constructor() {
    this.setupDefaultFiles()
  }

  private setupDefaultFiles() {
    // Root folders
    this.files.set(1, {
      id: 1,
      name: 'DCIM',
      type: 'folder',
      size: 0,
      parentId: 0,
      modifiedTime: new Date('2024-01-01')
    })
    
    this.files.set(2, {
      id: 2,
      name: 'Pictures',
      type: 'folder',
      size: 0,
      parentId: 0,
      modifiedTime: new Date('2024-01-01')
    })
    
    // Sample files
    this.files.set(100, {
      id: 100,
      name: 'IMG_20240101_120000.jpg',
      type: 'file',
      size: 2097152,
      parentId: 1,
      modifiedTime: new Date('2024-01-01T12:00:00')
    })
    
    this.files.set(101, {
      id: 101,
      name: 'VID_20240102_150000.mp4',
      type: 'file',
      size: 10485760,
      parentId: 1,
      modifiedTime: new Date('2024-01-02T15:00:00')
    })
  }

  connect() {
    this.connected = true
  }

  disconnect() {
    this.connected = false
  }

  addFile(file: any) {
    this.files.set(file.id, file)
  }

  removeFile(id: number) {
    this.files.delete(id)
  }

  getFile(id: number) {
    return this.files.get(id)
  }

  listFiles(parentId?: number) {
    const files = Array.from(this.files.values())
    if (parentId !== undefined) {
      return files.filter(f => f.parentId === parentId)
    }
    return files
  }

  reset() {
    this.files.clear()
    this.connected = true
    this.setupDefaultFiles()
  }
}