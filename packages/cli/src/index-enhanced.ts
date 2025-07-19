#!/usr/bin/env node

/**
 * @fileoverview Enhanced MTP Transfer CLI Entry Point
 * @description Main entry point with enhanced user feedback
 */

import { program } from 'commander';
import { registerDetectCommandEnhanced } from './commands/detect-enhanced';
import { registerListCommandEnhanced } from './commands/list-enhanced';
import { registerTransferCommand } from './commands/transfer';
import { registerResumeCommand } from './commands/resume';
import { registerStatusCommand } from './commands/status';
import { registerExportCommand } from './commands/export';
import { createUserFeedback } from './utils/feedback';
import { AnimatedTransition } from './utils/animations';
import chalk from 'chalk';

// Enhanced version info
const VERSION = '1.0.0-enhanced';
const DESCRIPTION = 'MTP 檔案傳輸工具 - 增強版';

/**
 * Show enhanced welcome message
 */
async function showWelcome(): Promise<void> {
  if (process.argv.length === 2) {
    console.clear();
    await AnimatedTransition.fadeIn('🚀 MTP Transfer Enhanced', 500);
    console.log(chalk.dim('智慧續傳・進度顯示・動畫回饋'));
    console.log('');
  }
}

/**
 * Configure program
 */
function configureProgram(): void {
  program
    .name('mtp-transfer')
    .description(DESCRIPTION)
    .version(VERSION)
    .option('-v, --verbose', '顯示詳細資訊', false)
    .option('-q, --quiet', '安靜模式', false)
    .option('--no-color', '停用顏色輸出', false)
    .option('--json', 'JSON 格式輸出', false);
}

/**
 * Register all commands
 */
function registerCommands(): void {
  // Enhanced commands
  registerDetectCommandEnhanced(program);
  registerListCommandEnhanced(program);
  
  // Standard commands (to be enhanced later)
  registerTransferCommand(program);
  registerResumeCommand(program);
  registerStatusCommand(program);
  registerExportCommand(program);
  
  // Add help enhancement
  program.on('--help', () => {
    console.log('');
    console.log(chalk.bold('範例:'));
    console.log('  $ mtp-transfer detect                    # 偵測連接的裝置');
    console.log('  $ mtp-transfer list                      # 列出裝置根目錄');
    console.log('  $ mtp-transfer list /DCIM/Camera -r      # 遞迴列出相機資料夾');
    console.log('  $ mtp-transfer transfer ~/Pictures       # 傳輸圖片到本地');
    console.log('  $ mtp-transfer resume                    # 續傳未完成的傳輸');
    console.log('  $ mtp-transfer status --watch            # 即時監控傳輸狀態');
    console.log('');
    console.log(chalk.bold('提示:'));
    console.log('  • 使用 --verbose 查看詳細資訊');
    console.log('  • 使用 --json 輸出 JSON 格式供程式處理');
    console.log('  • 傳輸大量檔案時建議使用 --concurrency 控制並發數');
    console.log('');
  });
}

/**
 * Handle unknown commands
 */
function handleUnknownCommand(): void {
  program.on('command:*', (operands) => {
    const feedback = createUserFeedback();
    feedback.showError(`未知的命令: ${operands[0]}`);
    feedback.showTips([
      '使用 "mtp-transfer --help" 查看可用命令',
      '使用 "mtp-transfer <命令> --help" 查看命令說明'
    ]);
    process.exit(1);
  });
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Show welcome for interactive mode
    await showWelcome();
    
    // Configure program
    configureProgram();
    
    // Register commands
    registerCommands();
    
    // Handle unknown commands
    handleUnknownCommand();
    
    // Parse arguments
    await program.parseAsync(process.argv);
    
    // Show help if no command provided
    if (process.argv.length === 2) {
      program.help();
    }
    
  } catch (error) {
    const feedback = createUserFeedback();
    
    if (error instanceof Error) {
      feedback.showError(error, process.env.DEBUG ? error.stack : undefined);
    } else {
      feedback.showError('發生未預期的錯誤');
    }
    
    process.exit(1);
  }
}

// Handle process events
process.on('SIGINT', () => {
  console.log('\n\n' + chalk.yellow('⚠️ 使用者中斷操作'));
  process.exit(130);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ 未捕獲的異常:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('❌ 未處理的 Promise 拒絕:'), reason);
  process.exit(1);
});

// Start application
main().catch(error => {
  console.error(chalk.red('❌ 啟動失敗:'), error);
  process.exit(1);
});