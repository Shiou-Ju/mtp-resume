/**
 * @fileoverview MTP Transfer Core Package Entry Point
 * @description Exports all core modules for MTP file transfer functionality
 */

// Core modules
import { TransferDatabase } from './database';
import { MTPWrapper } from './mtp-wrapper';
// import FileDiffer from './file-differ';
// import TransferManager from './transfer-manager';

/**
 * Package information interface
 */
export interface PackageInfo {
  name: string;
  version: string;
  status: 'initialized' | 'ready' | 'error';
  modules: {
    database: 'pending' | 'ready' | 'error';
    mtpWrapper: 'pending' | 'ready' | 'error';
    fileDiffer: 'pending' | 'ready' | 'error';
    transferManager: 'pending' | 'ready' | 'error';
  };
}

/**
 * Get package information
 * @returns Package identification and status
 */
export function getPackageInfo(): PackageInfo {
  return {
    name: '@mtp-transfer/core',
    version: '1.0.0',
    status: 'initialized',
    modules: {
      database: 'ready',
      mtpWrapper: 'ready',
      fileDiffer: 'pending',
      transferManager: 'pending'
    }
  };
}

// Export core modules (will be uncommented as they are implemented)
export { TransferDatabase };
export type { 
  TransferRecord, 
  NewTransferRecord, 
  UpdateTransferRecord,
  DatabaseOptions,
  TransferStats,
  DatabaseInfo,
  TransferStatus
} from './database';

export { MTPWrapper };
export type {
  MTPDevice,
  MTPFile,
  MTPWrapperOptions,
  MTPCommandResult,
  MTPDownloadOptions,
  MTPListOptions,
  MTPTransferProgress,
  MTPDeviceInfo,
  MTPStorageInfo,
  MTPErrorCode
} from './mtp-wrapper';

// export { FileDiffer };
// export { TransferManager };

// For development testing
if (require.main === module) {
  console.log('MTP Transfer Core Package');
  console.log(JSON.stringify(getPackageInfo(), null, 2));
}