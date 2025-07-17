#!/usr/bin/env node

/**
 * @fileoverview MTP Transfer CLI Entry Point
 * @description Command-line interface for MTP file transfer with resume capability
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { registerDetectCommand } from './commands/detect';
import { registerListCommand } from './commands/list';
import { registerTransferCommand } from './commands/transfer';
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

// Placeholder commands (will be implemented next)

program
  .command('resume [session-id]')
  .description('恢復中斷的傳輸')
  .option('-l, --list', '列出所有可恢復的傳輸', false)
  .option('-f, --force', '強制恢復（即使裝置已變更）', false)
  .action((sessionId: string | undefined, options: any) => {
    if (options.list) {
      console.log(chalk.blue('📋 可恢復的傳輸:'));
    } else if (sessionId) {
      console.log(chalk.blue('🔄 恢復傳輸:'), sessionId);
    }
    console.log(chalk.yellow('⚠ 此功能即將實作'));
  });

program
  .command('status')
  .description('查看傳輸狀態')
  .option('-q, --queue', '顯示詳細佇列資訊', false)
  .option('-w, --watch', '監看模式', false)
  .option('-i, --interval <seconds>', '更新間隔（秒）', '1')
  .action((_options: any) => {
    console.log(chalk.blue('📊 傳輸狀態'));
    console.log(chalk.yellow('⚠ 此功能即將實作'));
  });

program
  .command('export [file]')
  .description('匯出傳輸記錄')
  .option('-f, --format <type>', '輸出格式: csv, json', 'csv')
  .option('-s, --status <type>', '篩選狀態: all, completed, failed, pending', 'all')
  .option('--limit <n>', '限制記錄數量')
  .option('--since <date>', '只包含此日期之後的記錄')
  .action((file: string | undefined, options: any) => {
    const output = file || `transfer-log.${options.format}`;
    console.log(chalk.blue('📄 匯出至:'), output);
    console.log(chalk.blue('📋 格式:'), options.format);
    console.log(chalk.yellow('⚠ 此功能即將實作'));
  });

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

// Error handling
program.on('command:*', () => {
  console.error(chalk.red('✗ 未知命令:'), program.args.join(' '));
  console.log(chalk.blue('使用'), chalk.yellow('mtp-transfer --help'), chalk.blue('查看可用命令'));
  process.exit(1);
});

// Handle uncaught errors
process.on('unhandledRejection', (error: any) => {
  console.error(chalk.red('✗ 未處理的錯誤:'), error.message || error);
  if (program.opts().verbose && error.stack) {
    console.error(chalk.dim(error.stack));
  }
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}