/**
 * @fileoverview Transfer Command Implementation
 * @description Transfer files to MTP device with progress tracking
 */

// @ts-ignore
import ora from 'ora';
import { promises as fs } from 'fs';
import { TransferManager, TransferDatabase, type FileScanOptions } from '@mtp-transfer/core';
import type { CommandContext, TransferOptions } from '../types/cli-types';
import { createLogger } from '../utils/logger';
import { createProgressDisplay } from '../utils/progress';
import { formatBytes } from '../utils/formatter';
import { handleError } from '../utils/error-handler';
import { createEdgeCaseHandler } from '../utils/edge-case-handler';

/**
 * Transfer command handler
 */
export async function transferCommand(
  localPath: string,
  context: CommandContext<TransferOptions>
): Promise<void> {
  const { options } = context;
  const logger = createLogger({ useColor: !options.noColor, verbose: options.verbose || false });
  
  // Show initial spinner
  const spinner = ora({
    text: '準備傳輸...',
    spinner: 'dots',
    color: 'blue'
  }).start();

  try {
    // Edge case validation
    spinner.text = '驗證輸入參數...';
    const edgeCaseHandler = createEdgeCaseHandler({ useColor: !options.noColor, verbose: options.verbose || false });
    const validation = await edgeCaseHandler.validateAll({
      paths: [localPath],
      commandOptions: options,
      checkSystem: true
    });

    if (!validation.valid) {
      throw new Error('輸入驗證失敗');
    }

    // Validate local path
    spinner.text = '驗證本地路徑...';
    const localStats = await fs.stat(localPath);
    if (!localStats.isDirectory()) {
      throw new Error(`路徑不是目錄: ${localPath}`);
    }

    // Initialize database
    spinner.text = '初始化資料庫...';
    const dbPath = options.db || 'transfers.db';
    const db = new TransferDatabase(dbPath);
    logger.debug(`使用資料庫: ${dbPath}`);

    // Initialize progress display
    const progressDisplay = createProgressDisplay({ 
      useColor: !options.noColor, 
      detailed: !options.noProgress 
    });

    // Initialize transfer manager
    spinner.text = '初始化傳輸管理器...';
    const transferManager = new TransferManager({
      db,
      concurrency: parseInt(String(options.concurrency || '3')),
      retryLimit: 3,
      retryDelay: 1000,
      onProgress: (progress) => {
        progressDisplay.updateOverall({
          currentFile: progress.currentFile,
          percentage: progress.overallProgress,
          speed: progress.currentSpeed || 0,
          eta: progress.estimatedTimeRemaining || 0,
          filesCompleted: progress.filesCompleted,
          filesTotal: progress.filesTotal,
          bytesTransferred: progress.bytesTransferred,
          bytesTotal: progress.bytesTotal
        });
      },
      onError: (error, file) => {
        logger.error(`傳輸失敗: ${file?.fileName || 'unknown'} - ${error.message}`);
      },
      onFileStart: (file) => {
        logger.debug(`開始傳輸: ${file.fileName}`);
        if (!options.noProgress) {
          progressDisplay.addFile(file.path, file.fileName, file.size);
        }
      },
      onFileComplete: (file, success, error) => {
        if (success) {
          logger.debug(`完成傳輸: ${file.fileName}`);
          if (!options.noProgress) {
            progressDisplay.completeFile(file.path);
          }
        } else {
          logger.error(`傳輸失敗: ${file.fileName} - ${error?.message}`);
        }
      },
      onComplete: (result) => {
        const stats = result.batch.stats;
        progressDisplay.complete({
          successful: stats.successCount,
          failed: stats.failureCount,
          totalTime: stats.duration
        });
        
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        }
      }
    });

    // Dry run mode
    if (options.dryRun) {
      spinner.text = '執行模擬檢查...';
      
      // Create filter from options
      const filter: FileScanOptions | undefined = options.filter || options.exclude ? {
        ...(options.filter && { includePatterns: [options.filter] }),
        ...(options.exclude && { excludePatterns: [options.exclude] }),
        recursive: true
      } : undefined;
      
      const comparison = await transferManager.scanAndCompare(localPath, filter);

      spinner.succeed('模擬檢查完成');
      
      console.log('\n' + '📋 模擬傳輸結果:');
      console.log(`  新檔案: ${comparison.newFiles.length} 個`);
      console.log(`  修改檔案: ${comparison.modifiedFiles.length} 個`);
      console.log(`  重複檔案: ${comparison.duplicateFiles.length} 個`);
      
      const totalSize = [...comparison.newFiles, ...comparison.modifiedFiles]
        .reduce((sum, file) => sum + file.size, 0);
      
      console.log(`  總大小: ${formatBytes(totalSize)}`);
      
      if (options.verbose) {
        console.log('\n新檔案:');
        comparison.newFiles.forEach((file) => {
          console.log(`  + ${file.relativePath} (${formatBytes(file.size)})`);
        });
        
        if (comparison.modifiedFiles.length > 0) {
          console.log('\n修改檔案:');
          comparison.modifiedFiles.forEach((file) => {
            console.log(`  ~ ${file.relativePath} (${formatBytes(file.size)})`);
          });
        }
      }
      
      return;
    }

    // Real transfer
    spinner.text = '開始傳輸...';
    spinner.stop();
    
    // Build transfer options
    const transferOptions: Parameters<typeof transferManager.startTransfer>[1] = {
      overwrite: options.overwrite || false,
      verifyAfterTransfer: options.verify || false,
      deleteAfterTransfer: options.move || false,
      preserveTimestamp: true,
      skipErrors: false,
      maxRetries: 3,
      mode: options.move ? 'move' : 'copy'
    };
    
    if (options.sessionId) {
      transferOptions.sessionId = options.sessionId;
    }
    
    if (options.filter || options.exclude) {
      transferOptions.filter = {
        ...(options.filter && { includePatterns: [options.filter] }),
        ...(options.exclude && { excludePatterns: [options.exclude] }),
        recursive: true
      };
    }
    
    // Start transfer
    const result = await transferManager.startTransfer(localPath, transferOptions);
    
    // Handle result
    if (result.success) {
      logger.success('傳輸成功完成');
      
      if (!options.json) {
        console.log('\n' + '📊 傳輸統計:');
        console.log(`  會話 ID: ${result.session.id}`);
        console.log(`  成功: ${result.batch.stats.successCount} 個檔案`);
        console.log(`  失敗: ${result.batch.stats.failureCount} 個檔案`);
        console.log(`  跳過: ${result.batch.stats.skippedCount} 個檔案`);
        console.log(`  總時間: ${Math.round(result.batch.stats.duration / 1000)}秒`);
        console.log(`  平均速度: ${formatBytes(result.batch.stats.averageSpeed)}/s`);
        
        if (result.batch.stats.failureCount > 0) {
          console.log('\n' + '❌ 失敗的檔案:');
          result.batch.failed.forEach((failure) => {
            console.log(`  - ${failure.file.fileName}: ${failure.error.message}`);
          });
        }
      }
    } else {
      progressDisplay.error(result.error?.message || '未知錯誤');
      process.exit(1);
    }

  } catch (error) {
    spinner.fail('傳輸準備失敗');
    
    // Use centralized error handler
    handleError(error instanceof Error ? error : new Error(String(error)), logger, {
      command: 'transfer',
      operation: 'transfer_files'
    });
  }
}

/**
 * Validate transfer options
 */
function validateOptions(options: TransferOptions): void {
  // Validate concurrency
  if (options.concurrency) {
    const concurrency = parseInt(String(options.concurrency));
    if (isNaN(concurrency) || concurrency < 1 || concurrency > 10) {
      throw new Error('並行數必須在 1-10 之間');
    }
  }
  
  // Validate destination
  if (options.destination && !options.destination.startsWith('/')) {
    throw new Error('目標路徑必須以 / 開頭');
  }
}

/**
 * Register transfer command
 */
export function registerTransferCommand(program: any): void {
  program
    .command('transfer <local-path>')
    .description('傳輸檔案到 MTP 裝置')
    .option('-d, --destination <path>', 'MTP 裝置上的目標路徑', '/')
    .option('-f, --filter <pattern>', '檔案篩選模式 (glob)')
    .option('-e, --exclude <pattern>', '排除檔案模式 (glob)')
    .option('-c, --concurrency <n>', '並行傳輸數量', '3')
    .option('--overwrite', '覆蓋已存在的檔案', false)
    .option('--verify', '傳輸後驗證檔案', false)
    .option('--dry-run', '模擬執行，不實際傳輸', false)
    .option('--no-progress', '不顯示進度條', false)
    .option('--move', '移動檔案（傳輸後刪除原檔案）', false)
    .action(async (localPath: string, options: TransferOptions) => {
      // Validate options
      try {
        validateOptions(options);
      } catch (error) {
        console.error('選項錯誤:', (error as Error).message);
        process.exit(1);
      }
      
      // Merge with global options
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      
      await transferCommand(localPath, {
        options: mergedOptions,
        command: 'transfer',
        startTime: new Date()
      });
    });
}