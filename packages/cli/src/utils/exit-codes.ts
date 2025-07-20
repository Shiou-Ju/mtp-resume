/**
 * Standard exit codes for CLI commands
 */

export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  NO_DEVICE = 2,
  DEVICE_BUSY = 3,
  PERMISSION_DENIED = 4,
  COMMAND_NOT_FOUND = 5,
  TIMEOUT = 6,
  TRANSFER_FAILED = 7,
  FILE_NOT_FOUND = 8,
  INVALID_ARGUMENT = 9,
  DATABASE_ERROR = 10,
  NETWORK_ERROR = 11,
  USER_CANCELLED = 12
}

/**
 * Get exit code from error
 */
export function getExitCodeFromError(error: Error): ExitCode {
  const message = error.message.toLowerCase();
  
  if (message.includes('no mtp device') || 
      message.includes('no raw devices found') ||
      message.includes('device not found')) {
    return ExitCode.NO_DEVICE;
  }
  
  if (message.includes('device is busy') || 
      message.includes('resource busy')) {
    return ExitCode.DEVICE_BUSY;
  }
  
  if (message.includes('permission denied') || 
      message.includes('access denied')) {
    return ExitCode.PERMISSION_DENIED;
  }
  
  if (message.includes('command not found') || 
      message.includes('mtp-detect')) {
    return ExitCode.COMMAND_NOT_FOUND;
  }
  
  if (message.includes('timeout')) {
    return ExitCode.TIMEOUT;
  }
  
  if (message.includes('transfer failed')) {
    return ExitCode.TRANSFER_FAILED;
  }
  
  if (message.includes('file not found') || 
      message.includes('no such file')) {
    return ExitCode.FILE_NOT_FOUND;
  }
  
  if (message.includes('invalid argument') || 
      message.includes('missing required argument')) {
    return ExitCode.INVALID_ARGUMENT;
  }
  
  if (message.includes('database')) {
    return ExitCode.DATABASE_ERROR;
  }
  
  if (message.includes('network') || 
      message.includes('connection')) {
    return ExitCode.NETWORK_ERROR;
  }
  
  return ExitCode.GENERAL_ERROR;
}