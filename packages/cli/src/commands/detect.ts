/**
 * @fileoverview Detect Command Implementation
 * @description Detect connected MTP devices
 */

// @ts-ignore
import ora from 'ora';
import { MTPWrapper } from '@mtp-transfer/core';
import type { CommandContext, DetectOptions, DeviceDisplay } from '../types/cli-types';
import { createFormatter, formatBytes } from '../utils/formatter';
import { createLogger } from '../utils/logger';
import { ExitCode, getExitCodeFromError } from '../utils/exit-codes';

/**
 * Detect command handler
 */
export async function detectCommand(context: CommandContext<DetectOptions>): Promise<void> {
  const { options } = context;
  const formatter = createFormatter(!options.noColor);
  const logger = createLogger({ useColor: !options.noColor, verbose: options.verbose || false });
  
  // Show spinner while detecting
  const spinner = ora({
    text: '偵測 MTP 裝置中...',
    spinner: 'dots',
    color: 'blue'
  }).start();

  try {
    // Create MTP wrapper instance
    const mtp = new MTPWrapper({ debug: options.verbose || false });
    
    // Detect device
    logger.debug('呼叫 MTP 偵測命令...');
    const device = await mtp.detectDevice();
    
    if (!device || !device.connected) {
      spinner.fail('未找到 MTP 裝置');
      
      // Provide helpful tips
      console.log('\n' + formatter.formatError(
        new Error('請確認:\n  1. 裝置已透過 USB 連接\n  2. 裝置已解鎖\n  3. 已選擇「檔案傳輸」模式\n  4. 已安裝必要的 MTP 工具 (libmtp)'),
        false
      ));
      
      process.exit(ExitCode.NO_DEVICE);
    }
    
    spinner.succeed('找到 MTP 裝置');
    
    // Prepare device display information
    const deviceDisplay: DeviceDisplay = {
      vendor: device.vendor,
      model: device.model,
      serialNumber: device.serialNumber,
      status: device.status
    };
    
    // Get detailed information if requested
    if (options.detailed) {
      logger.debug('取得詳細裝置資訊...');
      
      try {
        const deviceInfo = await mtp.getDeviceInfo();
        
        // Add storage information
        if (deviceInfo && deviceInfo.storageInfo && deviceInfo.storageInfo.length > 0) {
          deviceDisplay.storage = deviceInfo.storageInfo.map(storage => ({
            description: storage.description || storage.volumeLabel,
            usedPercentage: Math.round((storage.usedSpace / storage.totalSpace) * 100),
            freeSpace: formatBytes(storage.freeSpace),
            totalSpace: formatBytes(storage.totalSpace)
          }));
        }
        
        // Log additional details in verbose mode
        if (options.verbose && deviceInfo) {
          logger.debug(`支援的格式: ${deviceInfo.supportedFormats?.join(', ') || '未知'}`);
          if (deviceInfo.batteryLevel !== undefined) {
            logger.debug(`電池電量: ${deviceInfo.batteryLevel}%`);
          }
        }
      } catch (error) {
        logger.warn('無法取得詳細裝置資訊');
        logger.debug(error instanceof Error ? error.message : String(error));
      }
    }
    
    // Output result
    if (options.json) {
      // JSON output
      console.log(JSON.stringify({
        success: true,
        device: deviceDisplay,
        timestamp: new Date().toISOString()
      }, null, 2));
    } else {
      // Formatted output
      console.log('\n' + formatter.formatDevice(deviceDisplay));
    }
    
    // Success
    logger.debug('裝置偵測完成');
    
  } catch (error) {
    spinner.fail('偵測失敗');
    
    let exitCode = ExitCode.GENERAL_ERROR;
    
    if (error instanceof Error) {
      exitCode = getExitCodeFromError(error);
      
      // Handle specific error types with helpful messages
      if (error.message.includes('mtp-detect')) {
        logger.error('找不到 mtp-detect 命令');
        console.log('\n請安裝 libmtp:');
        console.log('  Ubuntu/Debian: sudo apt-get install mtp-tools');
        console.log('  macOS: brew install libmtp');
        console.log('  Arch Linux: sudo pacman -S libmtp');
      } else if (error.message.includes('permission')) {
        logger.error('權限不足');
        console.log('\n請嘗試使用 sudo 執行或將使用者加入相關群組');
      } else if (error.message.includes('device is busy')) {
        logger.error('裝置忙碌中');
        console.log('\n請確認沒有其他應用程式正在使用該裝置');
      } else {
        logger.error(error);
      }
    } else {
      logger.error('未知錯誤');
    }
    
    process.exit(exitCode);
  }
}

/**
 * Register detect command
 */
export function registerDetectCommand(program: any): void {
  program
    .command('detect')
    .description('偵測連接的 MTP 裝置')
    .option('-d, --detailed', '顯示詳細裝置資訊', false)
    .action(async (options: DetectOptions) => {
      // Merge with global options
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      
      await detectCommand({
        options: mergedOptions,
        command: 'detect',
        startTime: new Date()
      });
    });
}