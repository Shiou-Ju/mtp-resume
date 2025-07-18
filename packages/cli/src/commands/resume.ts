/**
 * @fileoverview Resume Command Implementation
 * @description Resume interrupted file transfers
 */

// @ts-ignore
import ora from 'ora';
import chalk from 'chalk';
import { TransferManager, TransferDatabase } from '@mtp-transfer/core';
import type { CommandContext, ResumeOptions } from '../types/cli-types';
import { formatBytes, formatDate } from '../utils/formatter';
import { createLogger } from '../utils/logger';
import { createProgressDisplay } from '../utils/progress';

/**
 * Resume command handler
 */
export async function resumeCommand(
  sessionId: string | undefined,
  context: CommandContext<ResumeOptions>
): Promise<void> {
  const { options } = context;
  const logger = createLogger({ useColor: !options.noColor, verbose: options.verbose || false });
  
  // Initialize database
  const dbPath = options.db || 'transfers.db';
  const db = new TransferDatabase(dbPath);
  
  try {
    // List mode - show resumable transfers
    if (options.list || !sessionId) {
      const spinner = ora({
        text: '搜尋可恢復的傳輸...',
        spinner: 'dots',
        color: 'blue'
      }).start();
      
      // Get pending transfers from database
      const pendingTransfers = db.getTransfers('pending');
      const failedTransfers = db.getTransfers('failed');
      const allResumable = [...pendingTransfers, ...failedTransfers];
      
      spinner.stop();
      
      if (allResumable.length === 0) {
        logger.info('沒有可恢復的傳輸');
        return;
      }
      
      console.log(chalk.blue('\n📋 可恢復的傳輸:\n'));
      
      // Group transfers by unique paths (simulate sessions)
      const sessions = new Map<string, typeof allResumable>();
      
      allResumable.forEach(transfer => {
        const sessionKey = transfer.file_path.split('/')[0]; // Use first directory as session key
        if (!sessions.has(sessionKey)) {
          sessions.set(sessionKey, []);
        }
        sessions.get(sessionKey)!.push(transfer);
      });
      
      // Display sessions
      let sessionIndex = 1;
      sessions.forEach((transfers, sessionKey) => {
        const totalSize = transfers.reduce((sum, t) => sum + t.file_size, 0);
        const pendingCount = transfers.filter(t => t.status === 'pending').length;
        const failedCount = transfers.filter(t => t.status === 'failed').length;
        const latestUpdate = Math.max(...transfers.map(t => new Date(t.updated_at).getTime()));
        
        console.log(chalk.bold(`Session ${sessionIndex}: ${sessionKey}`));
        console.log(`  檔案數: ${transfers.length} (待傳: ${pendingCount}, 失敗: ${failedCount})`);
        console.log(`  總大小: ${formatBytes(totalSize)}`);
        console.log(`  最後更新: ${formatDate(new Date(latestUpdate))}`);
        console.log(`  使用命令: ${chalk.yellow(`mtp-transfer resume ${sessionIndex}`)}`);
        console.log('');
        
        sessionIndex++;
      });
      
      return;
    }
    
    // Resume specific session
    const spinner = ora({
      text: `準備恢復傳輸 Session ${sessionId}...`,
      spinner: 'dots',
      color: 'blue'
    }).start();
    
    // Parse session ID (could be index or actual session ID)
    const sessionIndex = parseInt(sessionId);
    let targetTransfers: any[] = [];
    
    if (!isNaN(sessionIndex)) {
      // Get by index
      const pendingTransfers = db.getTransfers('pending');
      const failedTransfers = db.getTransfers('failed');
      const allResumable = [...pendingTransfers, ...failedTransfers];
      
      // Group by sessions
      const sessions = new Map<string, typeof allResumable>();
      allResumable.forEach(transfer => {
        const sessionKey = transfer.file_path.split('/')[0];
        if (!sessions.has(sessionKey)) {
          sessions.set(sessionKey, []);
        }
        sessions.get(sessionKey)!.push(transfer);
      });
      
      // Get session by index
      const sessionKeys = Array.from(sessions.keys());
      if (sessionIndex > 0 && sessionIndex <= sessionKeys.length) {
        targetTransfers = sessions.get(sessionKeys[sessionIndex - 1]) || [];
      }
    }
    
    if (targetTransfers.length === 0) {
      spinner.fail(`找不到 Session ${sessionId}`);
      logger.error('請使用 mtp-transfer resume --list 查看可用的 session');
      process.exit(1);
    }
    
    spinner.succeed(`找到 ${targetTransfers.length} 個待恢復的檔案`);
    
    // Initialize progress display
    const progressDisplay = createProgressDisplay({ 
      useColor: !options.noColor, 
      detailed: true 
    });
    
    // Initialize transfer manager
    const transferManager = new TransferManager({
      db,
      concurrency: 3,
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
        logger.debug(`恢復傳輸: ${file.fileName}`);
        progressDisplay.addFile(file.path, file.fileName, file.size);
      },
      onFileComplete: (file, success, error) => {
        if (success) {
          logger.debug(`完成傳輸: ${file.fileName}`);
          progressDisplay.completeFile(file.path);
        } else {
          logger.error(`傳輸失敗: ${file.fileName} - ${error?.message}`);
        }
      }
    });
    
    // Resume transfers
    logger.info('開始恢復傳輸...');
    
    // Get the source directory from first transfer
    const sourcePath = targetTransfers[0].file_path.split('/').slice(0, -1).join('/') || '.';
    
    try {
      // Start transfer with resume mode
      const result = await transferManager.startTransfer(sourcePath, {
        sessionId: `resume-${sessionId}`,
        skipErrors: true,
        mode: 'copy'
      });
      
      if (result.success) {
        progressDisplay.complete({
          successful: result.batch.stats.successCount,
          failed: result.batch.stats.failureCount,
          totalTime: result.batch.stats.duration
        });
        
        logger.success('傳輸恢復完成');
        
        if (!options.json) {
          console.log('\n' + '📊 恢復統計:');
          console.log(`  成功: ${result.batch.stats.successCount} 個檔案`);
          console.log(`  失敗: ${result.batch.stats.failureCount} 個檔案`);
          console.log(`  跳過: ${result.batch.stats.skippedCount} 個檔案`);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
      } else {
        progressDisplay.error(result.error?.message || '恢復失敗');
        process.exit(1);
      }
    } catch (error) {
      progressDisplay.error(error instanceof Error ? error.message : '未知錯誤');
      logger.error(error instanceof Error ? error : new Error('未知錯誤'));
      process.exit(1);
    }
    
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error);
    } else {
      logger.error('未知錯誤');
    }
    process.exit(1);
  } finally {
    db.close();
  }
}

/**
 * Register resume command
 */
export function registerResumeCommand(program: any): void {
  program
    .command('resume [session-id]')
    .description('恢復中斷的傳輸')
    .option('-l, --list', '列出所有可恢復的傳輸', false)
    .option('-f, --force', '強制恢復（即使裝置已變更）', false)
    .action(async (sessionId: string | undefined, options: ResumeOptions) => {
      // Merge with global options
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      
      await resumeCommand(sessionId, {
        options: mergedOptions,
        command: 'resume',
        startTime: new Date()
      });
    });
}