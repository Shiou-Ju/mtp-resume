/**
 * @fileoverview Export Command Implementation
 * @description Export transfer records to CSV or JSON format
 */

import { promises as fs } from 'fs';
import path from 'path';
// @ts-ignore
import ora from 'ora';
import chalk from 'chalk';
import { TransferDatabase } from '@mtp-transfer/core';
import type { CommandContext, ExportOptions } from '../types/cli-types';
import { formatBytes, formatDate } from '../utils/formatter';
import { createLogger } from '../utils/logger';

/**
 * Convert transfer record to CSV row
 */
function recordToCSVRow(record: any): string {
  const fields = [
    record.id,
    `"${record.file_path.replace(/"/g, '""')}"`, // Escape quotes
    record.file_size,
    record.status,
    formatDate(new Date(record.created_at)),
    formatDate(new Date(record.updated_at)),
    record.error ? `"${record.error.replace(/"/g, '""')}"` : ''
  ];
  
  return fields.join(',');
}

/**
 * Export command handler
 */
export async function exportCommand(
  outputFile: string | undefined,
  context: CommandContext<ExportOptions>
): Promise<void> {
  const { options } = context;
  const logger = createLogger({ useColor: !options.noColor, verbose: options.verbose || false });
  
  // Determine output filename
  const format = options.format || 'csv';
  const defaultFilename = `transfer-log-${new Date().toISOString().split('T')[0]}.${format}`;
  const filename = outputFile || defaultFilename;
  
  // Show spinner while exporting
  const spinner = ora({
    text: `匯出傳輸記錄到 ${filename}...`,
    spinner: 'dots',
    color: 'blue'
  }).start();
  
  try {
    // Initialize database
    const dbPath = options.db || 'transfers.db';
    const db = new TransferDatabase(dbPath, { readonly: true });
    
    // Get transfers based on status filter
    let transfers = options.status === 'all' 
      ? db.getTransfers()
      : options.status 
        ? db.getTransfers(options.status as any)
        : db.getTransfers();
    
    // Apply date filter if specified
    if (options.since) {
      const sinceDate = new Date(options.since);
      if (!isNaN(sinceDate.getTime())) {
        transfers = transfers.filter((t: any) => 
          new Date(t.created_at).getTime() >= sinceDate.getTime()
        );
        logger.debug(`過濾日期: ${sinceDate.toISOString()} 之後`);
      } else {
        spinner.warn('無效的日期格式，忽略日期過濾');
      }
    }
    
    // Apply limit if specified
    if (options.limit) {
      const limit = parseInt(String(options.limit));
      if (!isNaN(limit) && limit > 0) {
        transfers = transfers.slice(0, limit);
        logger.debug(`限制記錄數: ${limit}`);
      }
    }
    
    spinner.text = `準備匯出 ${transfers.length} 筆記錄...`;
    
    // Export based on format
    if (format === 'csv') {
      // CSV Export
      const csvContent: string[] = [];
      
      // Add header
      csvContent.push('ID,檔案路徑,檔案大小,狀態,建立時間,更新時間,錯誤訊息');
      
      // Add data rows
      transfers.forEach((record: any) => {
        csvContent.push(recordToCSVRow(record));
      });
      
      // Write to file
      await fs.writeFile(filename, csvContent.join('\n'), 'utf8');
      
    } else if (format === 'json') {
      // JSON Export
      const jsonData = {
        exportDate: new Date().toISOString(),
        recordCount: transfers.length,
        filters: {
          status: options.status || 'all',
          since: options.since || null,
          limit: options.limit || null
        },
        statistics: {
          totalTransfers: transfers.length,
          completedTransfers: transfers.filter((t: any) => t.status === 'completed').length,
          failedTransfers: transfers.filter((t: any) => t.status === 'failed').length,
          pendingTransfers: transfers.filter((t: any) => t.status === 'pending').length
        },
        records: transfers.map((record: any) => ({
          ...record,
          fileSizeFormatted: formatBytes(record.file_size),
          createdAtFormatted: formatDate(new Date(record.created_at)),
          updatedAtFormatted: formatDate(new Date(record.updated_at))
        }))
      };
      
      // Write to file with pretty formatting
      await fs.writeFile(filename, JSON.stringify(jsonData, null, 2), 'utf8');
      
    } else {
      throw new Error(`不支援的格式: ${format}`);
    }
    
    // Get file stats
    const fileStats = await fs.stat(filename);
    
    spinner.succeed(`成功匯出到 ${filename}`);
    
    // Display summary
    if (!options.json) {
      console.log(chalk.blue('\n📄 匯出摘要:'));
      console.log(`  檔案: ${path.resolve(filename)}`);
      console.log(`  格式: ${format.toUpperCase()}`);
      console.log(`  記錄數: ${transfers.length}`);
      console.log(`  檔案大小: ${formatBytes(fileStats.size)}`);
      
      // Show record breakdown
      const statusCounts = transfers.reduce((acc: any, t: any) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      if (Object.keys(statusCounts).length > 0) {
        console.log('\n  記錄分類:');
        Object.entries(statusCounts).forEach(([status, count]) => {
          const icon = status === 'completed' ? '✅' :
                      status === 'failed' ? '❌' :
                      status === 'pending' ? '⏳' : '❓';
          console.log(`    ${icon} ${status}: ${count}`);
        });
      }
      
      // Additional tips
      if (format === 'csv') {
        console.log(chalk.dim('\n💡 提示: 可使用 Excel 或 Google Sheets 開啟 CSV 檔案'));
      }
    } else {
      // JSON output for scripting
      console.log(JSON.stringify({
        success: true,
        filename: path.resolve(filename),
        format,
        recordCount: transfers.length,
        fileSize: fileStats.size,
        timestamp: new Date().toISOString()
      }, null, 2));
    }
    
    // Close database
    db.close();
    
  } catch (error) {
    spinner.fail('匯出失敗');
    
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('EACCES')) {
        logger.error(`沒有權限寫入檔案: ${filename}`);
      } else if (error.message.includes('ENOENT')) {
        logger.error(`找不到路徑: ${path.dirname(filename)}`);
      } else if (error.message.includes('ENOSPC')) {
        logger.error('磁碟空間不足');
      } else {
        logger.error(error);
      }
    } else {
      logger.error('未知錯誤');
    }
    
    process.exit(1);
  }
}

/**
 * Register export command
 */
export function registerExportCommand(program: any): void {
  program
    .command('export [file]')
    .description('匯出傳輸記錄')
    .option('-f, --format <type>', '輸出格式: csv, json', 'csv')
    .option('-s, --status <type>', '篩選狀態: all, completed, failed, pending', 'all')
    .option('--limit <n>', '限制記錄數量')
    .option('--since <date>', '只包含此日期之後的記錄 (YYYY-MM-DD)')
    .action(async (file: string | undefined, options: ExportOptions) => {
      // Validate format
      if (options.format && !['csv', 'json'].includes(options.format)) {
        console.error(chalk.red(`錯誤: 不支援的格式 '${options.format}'`));
        console.error(chalk.yellow('支援的格式: csv, json'));
        process.exit(1);
      }
      
      // Validate status
      if (options.status && !['all', 'completed', 'failed', 'pending'].includes(options.status)) {
        console.error(chalk.red(`錯誤: 無效的狀態 '${options.status}'`));
        console.error(chalk.yellow('有效的狀態: all, completed, failed, pending'));
        process.exit(1);
      }
      
      // Merge with global options
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      
      await exportCommand(file, {
        options: mergedOptions,
        command: 'export',
        startTime: new Date()
      });
    });
}