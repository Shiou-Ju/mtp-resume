#!/usr/bin/env node

/**
 * @fileoverview MTP Transfer CLI Entry Point
 * @description Command-line interface for MTP file transfer with resume capability
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createErrorHandler } from './utils/error-handler';
import { createLogger } from './utils/logger';
import { registerDetectCommand } from './commands/detect';
import { registerListCommand } from './commands/list';
import { registerTransferCommand } from './commands/transfer';
import { registerResumeCommand } from './commands/resume';
import { registerStatusCommand } from './commands/status';
import { registerExportCommand } from './commands/export';
import { registerDoctorCommand } from './commands/doctor';
// GlobalOptions is used in the command definitions

// Create main program
const program = new Command();

// Configure program
program
  .name('mtp-transfer')
  .description('智慧 MTP 檔案傳輸工具，支援斷點續傳')
  .version('1.0.0')
  .option('--db <path>', '資料庫檔案路徑', 'transfers.db')
  .option('--verbose', '顯示詳細輸出', false)
  .option('--no-color', '停用彩色輸出')
  .option('--json', '以 JSON 格式輸出', false);

// Register commands
registerDetectCommand(program);
registerListCommand(program);
registerTransferCommand(program);
registerResumeCommand(program);
registerStatusCommand(program);
registerExportCommand(program);
registerDoctorCommand(program);

// Development info command
program
  .command('info')
  .description('顯示套件資訊')
  .action(async () => {
    try {
      const { getPackageInfo } = await import('@mtp-transfer/core');
      const info = getPackageInfo();
      
      console.log(chalk.green('\n📦 MTP Transfer CLI'));
      console.log(chalk.blue('CLI 版本:'), '1.0.0');
      console.log(chalk.blue('Core 版本:'), info.version);
      console.log(chalk.blue('Core 狀態:'), info.status);
      console.log('\n模組狀態:');
      Object.entries(info.modules).forEach(([module, status]) => {
        const icon = status === 'ready' ? '✅' : status === 'pending' ? '⏳' : '❌';
        console.log(`  ${icon} ${module}: ${status}`);
      });
    } catch (error) {
      console.log(chalk.green('\n📦 MTP Transfer CLI'));
      console.log(chalk.blue('版本:'), '1.0.0');
      console.log(chalk.yellow('Core 套件尚未載入'));
    }
  });

// Initialize error handling
const logger = createLogger({ useColor: !program.opts().noColor, verbose: program.opts().verbose });
const errorHandler = createErrorHandler(logger, { useColor: !program.opts().noColor, verbose: program.opts().verbose });

// Error handling
program.on('command:*', () => {
  console.error(chalk.red('✗ 未知命令:'), program.args.join(' '));
  console.log(chalk.blue('使用'), chalk.yellow('mtp-transfer --help'), chalk.blue('查看可用命令'));
  process.exit(1);
});

// Handle uncaught errors with new error handler
process.on('unhandledRejection', (error: any) => {
  errorHandler.handle(error instanceof Error ? error : new Error(String(error)), {
    command: 'system',
    operation: 'unhandled_rejection'
  });
});

process.on('uncaughtException', (error: Error) => {
  errorHandler.handle(error, {
    command: 'system', 
    operation: 'uncaught_exception'
  });
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}