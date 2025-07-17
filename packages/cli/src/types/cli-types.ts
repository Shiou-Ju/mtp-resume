/**
 * @fileoverview CLI Type Definitions
 * @description TypeScript interfaces for command line interface
 */

// TransferOptions will be imported when implemented

/**
 * Global CLI options available to all commands
 */
export interface GlobalOptions {
  /** Database file path */
  db?: string;
  /** Enable verbose output */
  verbose?: boolean;
  /** Disable colored output */
  noColor?: boolean;
  /** Output in JSON format */
  json?: boolean;
}

/**
 * Options for detect command
 */
export interface DetectOptions extends GlobalOptions {
  /** Show detailed device information */
  detailed?: boolean;
}

/**
 * Options for list command
 */
export interface ListOptions extends GlobalOptions {
  /** List files recursively */
  recursive?: boolean;
  /** Show hidden files */
  all?: boolean;
  /** Output format: table, tree, or json */
  format?: 'table' | 'tree' | 'json';
  /** Sort by: name, size, date */
  sort?: 'name' | 'size' | 'date';
  /** Reverse sort order */
  reverse?: boolean;
}

/**
 * Options for transfer command
 */
export interface TransferOptions extends GlobalOptions {
  /** Destination path on MTP device */
  destination?: string;
  /** File filter pattern (glob) */
  filter?: string;
  /** Exclude pattern (glob) */
  exclude?: string;
  /** Number of concurrent transfers */
  concurrency?: number;
  /** Overwrite existing files */
  overwrite?: boolean;
  /** Verify after transfer */
  verify?: boolean;
  /** Dry run - simulate transfer */
  dryRun?: boolean;
  /** Don't show progress bar */
  noProgress?: boolean;
  /** Delete source files after successful transfer */
  move?: boolean;
}

/**
 * Options for resume command
 */
export interface ResumeOptions extends GlobalOptions {
  /** List all resumable sessions */
  list?: boolean;
  /** Force resume even if device changed */
  force?: boolean;
}

/**
 * Options for status command
 */
export interface StatusOptions extends GlobalOptions {
  /** Show detailed queue information */
  queue?: boolean;
  /** Watch mode - refresh automatically */
  watch?: boolean;
  /** Refresh interval in seconds */
  interval?: number;
}

/**
 * Options for export command
 */
export interface ExportOptions extends GlobalOptions {
  /** Export format: csv or json */
  format?: 'csv' | 'json';
  /** Filter by status */
  status?: 'all' | 'completed' | 'failed' | 'pending';
  /** Limit number of records */
  limit?: number;
  /** Include only records after this date */
  since?: string;
}

/**
 * Command context passed to command handlers
 */
export interface CommandContext<T extends GlobalOptions = GlobalOptions> {
  /** Command options */
  options: T;
  /** Command name */
  command: string;
  /** Start time */
  startTime: Date;
}

/**
 * Progress information for display
 */
export interface ProgressInfo {
  /** Current file name */
  currentFile: string;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Transfer speed in bytes/sec */
  speed?: number;
  /** Estimated time remaining in seconds */
  eta?: number;
  /** Files completed */
  filesCompleted: number;
  /** Total files */
  filesTotal: number;
  /** Bytes transferred */
  bytesTransferred: number;
  /** Total bytes */
  bytesTotal: number;
}

/**
 * Device display information
 */
export interface DeviceDisplay {
  /** Device vendor */
  vendor: string;
  /** Device model */
  model: string;
  /** Serial number */
  serialNumber: string;
  /** Connection status */
  status: string;
  /** Storage information */
  storage?: StorageDisplay[];
}

/**
 * Storage display information
 */
export interface StorageDisplay {
  /** Storage description */
  description: string;
  /** Used percentage */
  usedPercentage: number;
  /** Free space formatted */
  freeSpace: string;
  /** Total space formatted */
  totalSpace: string;
}

/**
 * File display information
 */
export interface FileDisplay {
  /** File name */
  name: string;
  /** Formatted size */
  size: string;
  /** Formatted date */
  date: string;
  /** File type */
  type: string;
  /** File path */
  path: string;
}

/**
 * Output formatter interface
 */
export interface OutputFormatter {
  /** Format device information */
  formatDevice(device: DeviceDisplay): string;
  /** Format file list */
  formatFiles(files: FileDisplay[], options: ListOptions): string;
  /** Format progress */
  formatProgress(progress: ProgressInfo): string;
  /** Format error */
  formatError(error: Error, verbose: boolean): string;
}

/**
 * Logger interface
 */
export interface Logger {
  /** Log info message */
  info(message: string): void;
  /** Log success message */
  success(message: string): void;
  /** Log warning message */
  warn(message: string): void;
  /** Log error message */
  error(message: string | Error): void;
  /** Log debug message */
  debug(message: string): void;
}

/**
 * Command handler function type
 */
export type CommandHandler<T extends GlobalOptions = GlobalOptions> = 
  (context: CommandContext<T>) => Promise<void>;

/**
 * Command definition
 */
export interface CommandDefinition<T extends GlobalOptions = GlobalOptions> {
  /** Command name */
  name: string;
  /** Command description */
  description: string;
  /** Command handler */
  handler: CommandHandler<T>;
  /** Command options */
  options?: CommandOption[];
}

/**
 * Command option definition
 */
export interface CommandOption {
  /** Short flag (e.g., -v) */
  short?: string;
  /** Long flag (e.g., --verbose) */
  long: string;
  /** Option description */
  description: string;
  /** Default value */
  defaultValue?: any;
  /** Is required */
  required?: boolean;
  /** Value parser */
  parser?: (value: string) => any;
}