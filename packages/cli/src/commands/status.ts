/**
 * @fileoverview Status Command Implementation
 * @description Display transfer status and queue information
 */

// @ts-ignore
import ora from 'ora';
import chalk from 'chalk';
// @ts-ignore
import Table from 'cli-table3';
import { TransferDatabase } from '@mtp-transfer/core';
import type { CommandContext, StatusOptions } from '../types/cli-types';
import { formatBytes, formatDate } from '../utils/formatter';
import { createLogger } from '../utils/logger';

/**
 * Status command handler
 */
export async function statusCommand(context: CommandContext<StatusOptions>): Promise<void> {
  const { options } = context;
  const logger = createLogger({ useColor: !options.noColor, verbose: options.verbose || false });
  
  // Initialize database
  const dbPath = options.db || 'transfers.db';
  const db = new TransferDatabase(dbPath);
  
  try {
    // Get database statistics
    const allTransfers = db.getTransfers();
    const completedTransfers = db.getTransfers('completed').length;
    const failedTransfers = db.getTransfers('failed').length;
    const pendingTransfers = db.getTransfers('pending').length;
    const totalSize = allTransfers.reduce((sum, t) => sum + t.file_size, 0);
    const successRate = allTransfers.length > 0 
      ? (completedTransfers / allTransfers.length) * 100 
      : 0;
    
    const stats = {
      totalTransfers: allTransfers.length,
      completedTransfers,
      failedTransfers,
      pendingTransfers,
      totalSize,
      successRate
    };
    
    // Display overall statistics
    if (!options.json) {
      console.log(chalk.blue('\n📊 傳輸統計總覽\n'));
      
      const statsTable = new Table({
        head: ['項目', '數值'],
        style: {
          head: options.noColor ? [] : ['cyan']
        }
      });
      
      statsTable.push(
        ['總傳輸數', stats.totalTransfers.toString()],
        ['已完成', chalk.green(stats.completedTransfers.toString())],
        ['失敗', chalk.red(stats.failedTransfers.toString())],
        ['待傳輸', chalk.yellow(stats.pendingTransfers.toString())],
        ['總大小', formatBytes(stats.totalSize)],
        ['成功率', `${stats.successRate.toFixed(1)}%`]
      );
      
      console.log(statsTable.toString());
    }
    
    // Show queue information if requested
    if (options.queue) {
      // Get current transfers by status
      const pendingTransfers = db.getTransfers('pending');
      const failedTransfers = db.getTransfers('failed');
      
      if (!options.json) {
        // Pending transfers
        if (pendingTransfers.length > 0) {
          console.log(chalk.yellow('\n⏳ 待傳輸檔案\n'));
          
          const pendingTable = new Table({
            head: ['ID', '檔案路徑', '大小', '新增時間'],
            style: {
              head: options.noColor ? [] : ['cyan']
            }
          });
          
          pendingTransfers.slice(0, 10).forEach(transfer => {
            pendingTable.push([
              transfer.id.toString(),
              transfer.file_path.length > 50 
                ? '...' + transfer.file_path.slice(-47) 
                : transfer.file_path,
              formatBytes(transfer.file_size),
              formatDate(new Date(transfer.created_at))
            ]);
          });
          
          console.log(pendingTable.toString());
          
          if (pendingTransfers.length > 10) {
            console.log(chalk.dim(`... 還有 ${pendingTransfers.length - 10} 個檔案`));
          }
        }
        
        // Failed transfers
        if (failedTransfers.length > 0) {
          console.log(chalk.red('\n❌ 失敗的傳輸\n'));
          
          const failedTable = new Table({
            head: ['ID', '檔案路徑', '大小', '錯誤訊息'],
            style: {
              head: options.noColor ? [] : ['cyan']
            }
          });
          
          failedTransfers.slice(0, 10).forEach(transfer => {
            failedTable.push([
              transfer.id.toString(),
              transfer.file_path.length > 40 
                ? '...' + transfer.file_path.slice(-37) 
                : transfer.file_path,
              formatBytes(transfer.file_size),
              transfer.error ? transfer.error.slice(0, 30) + '...' : '未知錯誤'
            ]);
          });
          
          console.log(failedTable.toString());
          
          if (failedTransfers.length > 10) {
            console.log(chalk.dim(`... 還有 ${failedTransfers.length - 10} 個失敗檔案`));
          }
        }
      }
    }
    
    // Watch mode
    if (options.watch) {
      const interval = parseInt(String(options.interval || '1')) * 1000;
      
      console.log(chalk.dim('\n監看模式已啟動，按 Ctrl+C 結束...\n'));
      
      // Create spinner for updates
      const spinner = ora({
        text: '更新中...',
        spinner: 'dots',
        color: 'blue'
      });
      
      const updateStatus = async () => {
        spinner.start();
        
        // Clear screen
        console.clear();
        
        // Get fresh data
        const freshAllTransfers = db.getTransfers();
        const freshStats = {
          totalTransfers: freshAllTransfers.length,
          completedTransfers: db.getTransfers('completed').length,
          failedTransfers: db.getTransfers('failed').length,
          pendingTransfers: db.getTransfers('pending').length,
          totalSize: freshAllTransfers.reduce((sum, t) => sum + t.file_size, 0),
          successRate: freshAllTransfers.length > 0 
            ? (db.getTransfers('completed').length / freshAllTransfers.length) * 100 
            : 0
        };
        const activeTasks = db.getTransfers('pending').length;
        
        spinner.stop();
        
        // Display real-time status
        console.log(chalk.blue('🔄 即時傳輸狀態\n'));
        console.log(`最後更新: ${new Date().toLocaleTimeString()}`);
        console.log(`更新間隔: ${interval / 1000} 秒\n`);
        
        // Status summary
        console.log(chalk.bold('當前狀態:'));
        console.log(`  🟢 進行中: ${activeTasks} 個任務`);
        console.log(`  ✅ 已完成: ${freshStats.completedTransfers} 個檔案`);
        console.log(`  ❌ 失敗: ${freshStats.failedTransfers} 個檔案`);
        console.log(`  📊 成功率: ${freshStats.successRate.toFixed(1)}%`);
        
        // Recent activity
        const recentTransfers = db.getTransfers()
          .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 5);
        
        if (recentTransfers.length > 0) {
          console.log(chalk.bold('\n最近活動:'));
          recentTransfers.forEach((transfer: any) => {
            const statusIcon = transfer.status === 'completed' ? '✅' :
                             transfer.status === 'failed' ? '❌' : '⏳';
            const fileName = transfer.file_path.split('/').pop() || transfer.file_path;
            console.log(`  ${statusIcon} ${fileName} (${formatBytes(transfer.file_size)})`);
          });
        }
      };
      
      // Initial update
      await updateStatus();
      
      // Set up interval
      const watchInterval = setInterval(updateStatus, interval);
      
      // Handle exit
      process.on('SIGINT', () => {
        clearInterval(watchInterval);
        console.log(chalk.yellow('\n\n監看模式已結束'));
        process.exit(0);
      });
      
      // Keep process alive
      await new Promise(() => {});
    }
    
    // JSON output
    if (options.json) {
      const pendingList = db.getTransfers('pending');
      const failedList = db.getTransfers('failed');
      
      const output = {
        statistics: stats,
        queue: options.queue ? {
          pending: pendingList,
          failed: failedList
        } : undefined,
        timestamp: new Date().toISOString()
      };
      
      console.log(JSON.stringify(output, null, 2));
    }
    
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error);
    } else {
      logger.error('未知錯誤');
    }
    process.exit(1);
  } finally {
    if (!options.watch) {
      db.close();
    }
  }
}

/**
 * Register status command
 */
export function registerStatusCommand(program: any): void {
  program
    .command('status')
    .description('查看傳輸狀態')
    .option('-q, --queue', '顯示詳細佇列資訊', false)
    .option('-w, --watch', '監看模式', false)
    .option('-i, --interval <seconds>', '更新間隔（秒）', '1')
    .action(async (options: StatusOptions) => {
      // Merge with global options
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      
      await statusCommand({
        options: mergedOptions,
        command: 'status',
        startTime: new Date()
      });
    });
}