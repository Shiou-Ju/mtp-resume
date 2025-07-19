/**
 * MTP command output parser utilities
 * Parses text output from libmtp tools into structured TypeScript objects
 */

import { MTPDevice, MTPFile, MTPStorageInfo } from '../types/mtp-types';

export class MTPOutputParser {

  /**
   * Parse mtp-detect output to extract device information
   */
  static parseDeviceInfo(output: string): MTPDevice | null {
    if (!output || output.trim().length === 0) {
      return null;
    }

    const lines = output.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Look for device information patterns
    let vendor = 'Unknown';
    let model = 'Unknown';
    let serialNumber = 'Unknown';
    let deviceNumber = 0;
    let connected = false;

    for (const line of lines) {
      // Check for "No MTP devices found" or similar
      if (line.toLowerCase().includes('no mtp devices found') ||
          line.toLowerCase().includes('unable to open device') ||
          line.toLowerCase().includes('no raw devices found')) {
        return null;
      }

      // Device found indicator
      if (line.toLowerCase().includes('device:') || 
          line.toLowerCase().includes('found device')) {
        connected = true;
      }

      // Extract vendor information
      const vendorMatch = line.match(/(?:vendor|manufacturer):\s*(.+)/i);
      if (vendorMatch) {
        vendor = vendorMatch[1].trim();
      }

      // Extract model information  
      const modelMatch = line.match(/(?:model|product):\s*(.+)/i);
      if (modelMatch) {
        model = modelMatch[1].trim();
      }

      // Extract serial number
      const serialMatch = line.match(/(?:serial\s*number|serialnumber|serial):\s*(.+)/i);
      if (serialMatch) {
        serialNumber = serialMatch[1].trim();
      }

      // Extract device number
      const deviceMatch = line.match(/device\s*(\d+)/i);
      if (deviceMatch) {
        deviceNumber = parseInt(deviceMatch[1]);
        connected = true;
      }
    }

    // If we found any device information, return it
    if (connected || vendor !== 'Unknown' || model !== 'Unknown') {
      return {
        vendor,
        model,
        serialNumber,
        deviceNumber,
        connected,
        status: connected ? 'connected' : 'disconnected'
      };
    }

    return null;
  }

  /**
   * Parse mtp-files output to extract file list
   */
  static parseFileList(output: string): MTPFile[] {
    if (!output || output.trim().length === 0) {
      return [];
    }

    const files: MTPFile[] = [];
    const lines = output.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Check if it's the new format (File ID: format)
    if (output.includes('File ID:')) {
      return this.parseFileListNewFormat(output);
    }

    // Otherwise use old format parsing
    for (const line of lines) {
      // Skip header lines and empty lines
      if (line.startsWith('File listing') || 
          line.startsWith('Found') ||
          line.startsWith('===') ||
          line.startsWith('---') ||
          line.startsWith('Listing') ||
          line.toLowerCase().includes('ok.')) {
        continue;
      }

      const file = this.parseFileLine(line);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Parse a single file line from mtp-files output
   */
  private static parseFileLine(line: string): MTPFile | null {
    // Common patterns for mtp-files output:
    // "123456: filename.jpg (2048000 bytes)"
    // "123456: /DCIM/Camera/IMG_001.jpg (2048000 bytes) [image/jpeg]"
    // "123456: foldername/ (folder)"

    // Pattern 1: ID: filename (size) [mime-type]
    const pattern1 = /^(\d+):\s*(.+?)\s*\(([^)]+)\)(?:\s*\[([^\]]+)\])?/;
    const match1 = line.match(pattern1);
    
    if (match1) {
      const [, idStr, pathPart, sizePart, mimeType] = match1;
      const id = parseInt(idStr);
      const path = pathPart.trim();
      
      // Determine if it's a folder
      const isFolder = sizePart.toLowerCase().includes('folder') || 
                      sizePart.toLowerCase().includes('directory') ||
                      path.endsWith('/');
      
      // Extract size for files
      let size = 0;
      if (!isFolder) {
        const sizeMatch = sizePart.match(/(\d+)/);
        if (sizeMatch) {
          size = parseInt(sizeMatch[1]);
        }
      }

      // Extract filename from path
      const name = path.includes('/') ? path.split('/').pop() || path : path;
      
      return {
        id,
        path: path.startsWith('/') ? path : `/${path}`,
        name: name.replace(/\/$/, ''), // Remove trailing slash for folders
        size,
        type: isFolder ? 'folder' : 'file',
        mimeType: mimeType?.trim()
      };
    }

    // Pattern 2: Simple format "ID filename size"
    const pattern2 = /^(\d+)\s+(.+?)\s+(\d+)$/;
    const match2 = line.match(pattern2);
    
    if (match2) {
      const [, idStr, filename, sizeStr] = match2;
      const id = parseInt(idStr);
      const size = parseInt(sizeStr);
      const path = filename.startsWith('/') ? filename : `/${filename}`;
      const name = filename.includes('/') ? filename.split('/').pop() || filename : filename;
      
      return {
        id,
        path,
        name,
        size,
        type: 'file'
      };
    }

    return null;
  }

  /**
   * Parse file list in new format (File ID: format)
   */
  private static parseFileListNewFormat(output: string): MTPFile[] {
    const files: MTPFile[] = [];
    const fileBlocks = output.split(/File ID: /g).filter(block => block.trim());
    
    for (const block of fileBlocks) {
      const lines = block.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length === 0) continue;
      
      // First line has the ID
      const idMatch = lines[0].match(/^(\d+)/);
      if (!idMatch) continue;
      
      const id = parseInt(idMatch[1]);
      let filename = '';
      let fileSize = 0;
      let parentId = 0;
      let filetype = 'file';
      
      for (const line of lines) {
        if (line.startsWith('Filename:')) {
          filename = line.substring('Filename:'.length).trim();
        } else if (line.startsWith('File size:')) {
          const sizeMatch = line.match(/(\d+)/);
          if (sizeMatch) {
            fileSize = parseInt(sizeMatch[1]);
          }
        } else if (line.startsWith('Parent ID:')) {
          const parentMatch = line.match(/(\d+)/);
          if (parentMatch) {
            parentId = parseInt(parentMatch[1]);
          }
        } else if (line.startsWith('Filetype:')) {
          const typeStr = line.substring('Filetype:'.length).trim().toLowerCase();
          if (typeStr.includes('folder') || typeStr.includes('directory')) {
            filetype = 'folder';
          }
        }
      }
      
      if (filename) {
        files.push({
          id,
          parentId,
          path: `/${filename}`,
          name: filename,
          size: fileSize,
          type: filetype as 'file' | 'folder'
        });
      }
    }
    
    return files;
  }

  /**
   * Parse mtp-getfile progress output
   */
  static parseTransferProgress(output: string): { percentage: number; speed?: number | undefined } | null {
    // Look for progress patterns like:
    // "Progress: 45% (1024000/2048000 bytes) - 150 KB/s"
    // "Transferring... 67%"
    
    const progressMatch = output.match(/(\d+)%/);
    if (progressMatch) {
      const percentage = parseInt(progressMatch[1]);
      
      // Try to extract speed
      const speedMatch = output.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB)\/s/i);
      let speed: number | undefined;
      
      if (speedMatch) {
        const value = parseFloat(speedMatch[1]);
        const unit = speedMatch[2].toUpperCase();
        
        switch (unit) {
          case 'KB':
            speed = value * 1024;
            break;
          case 'MB':
            speed = value * 1024 * 1024;
            break;
          case 'GB':
            speed = value * 1024 * 1024 * 1024;
            break;
        }
      }
      
      return { percentage, speed: speed || undefined };
    }
    
    return null;
  }

  /**
   * Parse storage information from device output
   */
  static parseStorageInfo(output: string): MTPStorageInfo[] {
    const storages: MTPStorageInfo[] = [];
    const lines = output.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let currentStorage: Partial<MTPStorageInfo> = {};
    
    for (const line of lines) {
      // Storage ID
      const idMatch = line.match(/storage\s+id:\s*(\d+)/i);
      if (idMatch) {
        if (currentStorage.id !== undefined) {
          storages.push(currentStorage as MTPStorageInfo);
        }
        currentStorage = { id: parseInt(idMatch[1]) };
        continue;
      }
      
      // Description
      const descMatch = line.match(/description:\s*(.+)/i);
      if (descMatch) {
        currentStorage.description = descMatch[1].trim();
        continue;
      }
      
      // Volume label
      const labelMatch = line.match(/volume\s+label:\s*(.+)/i);
      if (labelMatch) {
        currentStorage.volumeLabel = labelMatch[1].trim();
        continue;
      }
      
      // Space information
      const spaceMatch = line.match(/(?:total|max)\s+space:\s*(\d+)/i);
      if (spaceMatch) {
        currentStorage.totalSpace = parseInt(spaceMatch[1]);
        continue;
      }
      
      const freeMatch = line.match(/free\s+space:\s*(\d+)/i);
      if (freeMatch) {
        currentStorage.freeSpace = parseInt(freeMatch[1]);
        continue;
      }
    }
    
    // Add the last storage if exists
    if (currentStorage.id !== undefined) {
      // Calculate used space
      if (currentStorage.totalSpace && currentStorage.freeSpace) {
        currentStorage.usedSpace = currentStorage.totalSpace - currentStorage.freeSpace;
      }
      storages.push(currentStorage as MTPStorageInfo);
    }
    
    return storages;
  }

  /**
   * Extract error messages from command output
   */
  static extractErrorMessage(output: string, stderr: string = ''): string {
    const combined = `${output}\n${stderr}`.toLowerCase();
    
    // Common error patterns
    const errorPatterns = [
      /error:\s*(.+)/i,
      /failed:\s*(.+)/i,
      /unable to\s*(.+)/i,
      /cannot\s*(.+)/i,
      /no mtp devices found/i,
      /device busy/i,
      /permission denied/i,
      /access denied/i,
      /file not found/i,
      /transfer failed/i
    ];
    
    for (const pattern of errorPatterns) {
      const match = combined.match(pattern);
      if (match) {
        return match[1] ? match[1].trim() : match[0].trim();
      }
    }
    
    return 'Unknown error occurred';
  }

  /**
   * Validate and clean file path
   */
  static validatePath(path: string): string {
    if (!path || path.trim().length === 0) {
      return '/';
    }
    
    let cleanPath = path.trim();
    
    // Ensure path starts with /
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }
    
    // Remove double slashes
    cleanPath = cleanPath.replace(/\/+/g, '/');
    
    // Remove trailing slash unless it's root
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }
    
    return cleanPath;
  }

  /**
   * Format file size for human readable display
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }
}