#!/usr/bin/env node

/**
 * @fileoverview MTP Transfer CLI Entry Point
 * @description Command-line interface for MTP file transfer with resume capability
 */

const { Command } = require('commander');
const chalk = require('chalk');

// Import core package (will be used in subsequent issues)
try {
  const core = require('@mtp-transfer/core');
  console.log(chalk.blue('✓ Core package loaded successfully'));
} catch (error) {
  console.log(chalk.yellow('⚠ Core package not yet available'));
}

const program = new Command();

program
  .name('mtp-transfer')
  .description('智慧 MTP 檔案傳輸工具，支援斷點續傳')
  .version('1.0.0');

// Placeholder commands (will be implemented in subsequent issues)
program
  .command('detect')
  .description('偵測 MTP 裝置')
  .action(() => {
    console.log(chalk.blue('🔍 偵測 MTP 裝置...'));
    console.log(chalk.yellow('⚠ 此功能將在後續階段實作'));
  });

program
  .command('transfer <destination>')
  .description('開始傳輸檔案')
  .option('-f, --filter <pattern>', '檔案篩選 (例如: *.jpg)')
  .option('-d, --db <path>', '資料庫路徑', './transfer.db')
  .action((destination, options) => {
    console.log(chalk.blue('📁 目標位置:'), destination);
    if (options.filter) {
      console.log(chalk.blue('🔍 檔案篩選:'), options.filter);
    }
    console.log(chalk.blue('💾 資料庫:'), options.db);
    console.log(chalk.yellow('⚠ 此功能將在後續階段實作'));
  });

program
  .command('export <output>')
  .description('匯出傳輸記錄')
  .action((output) => {
    console.log(chalk.blue('📄 匯出至:'), output);
    console.log(chalk.yellow('⚠ 此功能將在後續階段實作'));
  });

// Development info command
program
  .command('info')
  .description('顯示套件資訊')
  .action(() => {
    console.log(chalk.green('\n📦 MTP Transfer CLI'));
    console.log(chalk.blue('版本:'), '1.0.0');
    console.log(chalk.blue('狀態:'), 'monorepo 架構已建立');
    console.log(chalk.blue('下一步:'), '實作核心模組功能');
  });

// Error handling
program.on('command:*', () => {
  console.error(chalk.red('✗ 未知命令:'), program.args.join(' '));
  console.log(chalk.blue('使用'), chalk.yellow('mtp-transfer --help'), chalk.blue('查看可用命令'));
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}