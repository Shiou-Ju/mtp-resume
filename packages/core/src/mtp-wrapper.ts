/**
 * MTP (Media Transfer Protocol) device operations wrapper
 * Provides TypeScript interface for libmtp command-line tools
 */

import { CommandRunner, MTPError } from './utils/command-runner';
import { MTPOutputParser } from './utils/output-parser';
import { 
  MTPDevice, 
  MTPFile, 
  MTPWrapperOptions, 
  MTPCommandResult,
  MTPDownloadOptions,
  MTPListOptions,
  MTPTransferProgress,
  MTPDeviceInfo,
  MTPErrorCode,
  MTPStorageInfo
} from './types/mtp-types';

export class MTPWrapper {
  private commandRunner: CommandRunner;
  private options: Required<MTPWrapperOptions>;

  constructor(options: MTPWrapperOptions = {}) {
    this.options = {
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      debug: options.debug || false,
      mtpToolsPath: options.mtpToolsPath || ''
    };

    this.commandRunner = new CommandRunner(
      this.options.timeout,
      this.options.retries,
      this.options.debug
    );
  }

  /**
   * Detect connected MTP device
   */
  async detectDevice(): Promise<MTPDevice | null> {
    try {
      const command = this.getMTPCommand('mtp-detect');
      const result = await this.commandRunner.executeCommand(command, [], {
        timeout: this.options.timeout,
        retries: 1 // Device detection should be fast
      });

      return MTPOutputParser.parseDeviceInfo(result.output);
    } catch (error) {
      if (error instanceof MTPError && error.code === MTPErrorCode.DEVICE_NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if any MTP device is connected
   */
  async isDeviceConnected(): Promise<boolean> {
    const device = await this.detectDevice();
    return device !== null && device.connected;
  }

  /**
   * Get detailed device information including storage
   */
  async getDeviceInfo(): Promise<MTPDeviceInfo | null> {
    const device = await this.detectDevice();
    if (!device) {
      return null;
    }

    try {
      // Try to get storage information
      const storageInfo = await this.getStorageInfo();
      
      return {
        device,
        storageInfo
      };
    } catch (error) {
      // Return basic device info even if storage info fails
      return { device };
    }
  }

  /**
   * List files on the MTP device
   */
  async listFiles(_path: string = '/', options: MTPListOptions = {}): Promise<MTPFile[]> {
    const device = await this.detectDevice();
    if (!device || !device.connected) {
      throw new MTPError('No MTP device connected', MTPErrorCode.DEVICE_NOT_FOUND);
    }

    try {
      const command = this.getMTPCommand('mtp-files');
      const args: string[] = [];

      // Add recursive flag if requested
      if (options.recursive) {
        args.push('-r');
      }

      const result = await this.commandRunner.executeCommand(command, args, {
        timeout: this.options.timeout
      });

      let files = MTPOutputParser.parseFileList(result.output);

      // Apply filters if specified
      if (options.filter) {
        files = this.applyFileFilters(files, options.filter);
      }

      return files;
    } catch (error) {
      if (error instanceof MTPError) {
        throw error;
      }
      throw new MTPError(
        `Failed to list files: ${error}`,
        MTPErrorCode.COMMAND_FAILED
      );
    }
  }

  /**
   * Download a file from MTP device
   */
  async downloadFile(
    fileId: number, 
    destination: string, 
    options: MTPDownloadOptions = { destination }
  ): Promise<void> {
    const device = await this.detectDevice();
    if (!device || !device.connected) {
      throw new MTPError('No MTP device connected', MTPErrorCode.DEVICE_NOT_FOUND);
    }

    try {
      const command = this.getMTPCommand('mtp-getfile');
      const args = [fileId.toString(), options.destination];

      // Add overwrite flag if specified
      if (options.overwrite) {
        args.unshift('-o');
      }

      await this.commandRunner.executeCommand(command, args, {
        timeout: this.options.timeout * 2 // Allow more time for file transfer
      });

      // TODO: Implement progress callback if provided
      // This would require streaming the command output
      if (options.onProgress) {
        // For now, call with 100% completion
        options.onProgress({
          fileId,
          fileName: `file_${fileId}`,
          bytesTransferred: 0,
          totalBytes: 0,
          percentage: 100,
          speed: 0,
          estimatedTimeRemaining: 0
        });
      }

    } catch (error) {
      if (error instanceof MTPError) {
        throw error;
      }
      throw new MTPError(
        `Failed to download file ${fileId}: ${error}`,
        MTPErrorCode.TRANSFER_FAILED
      );
    }
  }

  /**
   * Get information about a specific file
   */
  async getFileInfo(fileId: number): Promise<MTPFile | null> {
    const files = await this.listFiles();
    return files.find(file => file.id === fileId) || null;
  }

  /**
   * Get storage information from device
   */
  async getStorageInfo(): Promise<MTPStorageInfo[]> {
    const device = await this.detectDevice();
    if (!device || !device.connected) {
      throw new MTPError('No MTP device connected', MTPErrorCode.DEVICE_NOT_FOUND);
    }

    try {
      const command = this.getMTPCommand('mtp-detect');
      const args = ['-v']; // Verbose mode for storage info

      const result = await this.commandRunner.executeCommand(command, args, {
        timeout: this.options.timeout
      });

      return MTPOutputParser.parseStorageInfo(result.output);
    } catch (error) {
      if (error instanceof MTPError) {
        throw error;
      }
      throw new MTPError(
        `Failed to get storage info: ${error}`,
        MTPErrorCode.COMMAND_FAILED
      );
    }
  }

  /**
   * Check if MTP tools are available on the system
   */
  async checkMTPToolsAvailability(): Promise<{
    mtpDetect: boolean;
    mtpFiles: boolean;
    mtpGetfile: boolean;
  }> {
    const [mtpDetect, mtpFiles, mtpGetfile] = await Promise.all([
      this.commandRunner.isCommandAvailable(this.getMTPCommand('mtp-detect')),
      this.commandRunner.isCommandAvailable(this.getMTPCommand('mtp-files')),
      this.commandRunner.isCommandAvailable(this.getMTPCommand('mtp-getfile'))
    ]);

    return { mtpDetect, mtpFiles, mtpGetfile };
  }

  /**
   * Get version information for MTP tools
   */
  async getMTPToolsVersion(): Promise<Record<string, string | null>> {
    const commands = ['mtp-detect', 'mtp-files', 'mtp-getfile'];
    const versions: Record<string, string | null> = {};

    for (const cmd of commands) {
      try {
        versions[cmd] = await this.commandRunner.getCommandVersion(this.getMTPCommand(cmd));
      } catch {
        versions[cmd] = null;
      }
    }

    return versions;
  }

  /**
   * Get the full command path for MTP tools
   */
  private getMTPCommand(command: string): string {
    if (this.options.mtpToolsPath) {
      return `${this.options.mtpToolsPath}/${command}`;
    }
    return command;
  }

  /**
   * Apply file filters to the file list
   */
  private applyFileFilters(files: MTPFile[], filter: NonNullable<MTPListOptions['filter']>): MTPFile[] {
    return files.filter(file => {
      // File type filter
      if (filter.fileTypes && filter.fileTypes.length > 0) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!extension || !filter.fileTypes.includes(extension)) {
          return false;
        }
      }

      // Size filters
      if (filter.minSize !== undefined && file.size < filter.minSize) {
        return false;
      }
      if (filter.maxSize !== undefined && file.size > filter.maxSize) {
        return false;
      }

      // Modified time filters
      if (file.modifiedTime) {
        if (filter.modifiedAfter && file.modifiedTime < filter.modifiedAfter) {
          return false;
        }
        if (filter.modifiedBefore && file.modifiedTime > filter.modifiedBefore) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Parse transfer progress from command output (for future use)
   * @internal Reserved for future streaming progress implementation
   */
  // @ts-expect-error: This method is reserved for future use in streaming progress implementation
  private _parseTransferProgress(output: string, fileId: number, fileName: string): MTPTransferProgress | null {
    const progress = MTPOutputParser.parseTransferProgress(output);
    if (!progress) {
      return null;
    }

    return {
      fileId,
      fileName,
      bytesTransferred: 0, // Would need to be calculated from actual output
      totalBytes: 0,       // Would need to be calculated from actual output
      percentage: progress.percentage,
      speed: progress.speed || 0,
      estimatedTimeRemaining: 0 // Would need to be calculated
    };
  }
}

// Export types for external use
export type {
  MTPDevice,
  MTPFile,
  MTPWrapperOptions,
  MTPCommandResult,
  MTPDownloadOptions,
  MTPListOptions,
  MTPTransferProgress,
  MTPDeviceInfo,
  MTPStorageInfo
};

export { MTPError, MTPErrorCode } from './types/mtp-types';