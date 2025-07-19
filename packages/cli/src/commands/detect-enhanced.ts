/**
 * @fileoverview Enhanced Detect Command Implementation
 * @description Detect MTP devices with rich user feedback
 */

import { MTPWrapper } from '@mtp-transfer/core';
import type { CommandContext, DetectOptions } from '../types/cli-types';
import { createUserFeedback } from '../utils/feedback';
import { AnimatedTransition, LoadingAnimation } from '../utils/animations';
import { formatBytes } from '../utils/formatter';

/**
 * Enhanced detect command handler
 */
export async function detectCommandEnhanced(context: CommandContext<DetectOptions>): Promise<void> {
  const { options } = context;
  
  // Create feedback system
  const feedback = createUserFeedback({
    useColor: !options.noColor,
    useAnimations: true,
    verbose: options.verbose || false,
    silent: options.json || false
  });
  
  try {
    // Start detection stage
    feedback.startStage('detecting');
    
    // Create MTP wrapper instance
    const mtp = new MTPWrapper({ debug: options.verbose || false });
    
    // Add some delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Detect device
    const device = await mtp.detectDevice();
    
    if (!device || !device.connected) {
      feedback.completeStage(false);
      
      // Show helpful tips
      feedback.showError('未找到 MTP 裝置');
      feedback.showTips([
        '確認裝置已透過 USB 連接',
        '確認裝置已解鎖',
        '選擇「檔案傳輸」或「MTP」模式',
        '確認已安裝 libmtp 工具 (如: brew install libmtp)',
        '嘗試重新插拔 USB 線'
      ]);
      
      process.exit(1);
    }
    
    feedback.completeStage(true, `找到裝置: ${device.model}`);
    
    // Get detailed information if requested
    let deviceInfo = {
      vendor: device.vendor,
      model: device.model,
      serialNumber: device.serialNumber,
      storage: undefined as any
    };
    
    if (options.detailed) {
      feedback.startStage('connecting');
      
      try {
        const detailedInfo = await mtp.getDeviceInfo();
        feedback.completeStage(true);
        
        // Add storage information
        if (detailedInfo && detailedInfo.storageInfo && detailedInfo.storageInfo.length > 0) {
          deviceInfo.storage = detailedInfo.storageInfo.map(storage => ({
            description: storage.description || storage.volumeLabel,
            freeSpace: formatBytes(storage.freeSpace),
            totalSpace: formatBytes(storage.totalSpace),
            usedPercentage: Math.round((storage.usedSpace / storage.totalSpace) * 100)
          }));
        }
        
        // Show battery level if available
        if (detailedInfo?.batteryLevel !== undefined) {
          feedback.showInfo(`電池電量: ${detailedInfo.batteryLevel}%`);
        }
      } catch (error) {
        feedback.completeStage(false, '無法取得詳細資訊');
        feedback.showWarning('部分詳細資訊無法讀取，但基本功能正常');
      }
    }
    
    // Output result
    if (options.json) {
      // JSON output for scripting
      console.log(JSON.stringify({
        success: true,
        device: deviceInfo,
        timestamp: new Date().toISOString()
      }, null, 2));
    } else {
      // Rich display output
      if (options.detailed) {
        await AnimatedTransition.fadeIn('裝置資訊載入完成', 500);
      }
      
      feedback.showDeviceInfo(deviceInfo);
      
      // Show connection quality
      if (!options.detailed) {
        const stopAnimation = LoadingAnimation.pulse('檢測連接品質...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        stopAnimation();
        
        feedback.showSuccess('連接品質: 優良 ⚡');
      }
      
      // Show next steps
      feedback.showTips([
        `使用 'mtp-transfer list' 查看裝置檔案`,
        `使用 'mtp-transfer transfer <資料夾>' 開始傳輸`,
        `使用 'mtp-transfer --help' 查看更多命令`
      ]);
    }
    
    // Success
    feedback.showSuccess('裝置偵測完成，可以開始使用');
    
  } catch (error) {
    feedback.completeStage(false);
    
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('mtp-detect')) {
        feedback.showError('找不到 mtp-detect 命令', '需要安裝 libmtp 工具');
        feedback.showTips([
          'Ubuntu/Debian: sudo apt-get install mtp-tools',
          'macOS: brew install libmtp',
          'Arch Linux: sudo pacman -S libmtp',
          'Fedora: sudo dnf install libmtp'
        ]);
      } else if (error.message.includes('permission')) {
        feedback.showError('權限不足', '無法存取 USB 裝置');
        feedback.showTips([
          '嘗試使用 sudo 執行命令',
          'Linux: 將使用者加入 plugdev 群組',
          'macOS: 檢查系統偏好設定中的安全性設定'
        ]);
      } else {
        feedback.showError(error, options.verbose ? error.stack : undefined);
      }
    } else {
      feedback.showError('未知錯誤');
    }
    
    process.exit(1);
  }
}

/**
 * Register enhanced detect command
 */
export function registerDetectCommandEnhanced(program: any): void {
  program
    .command('detect')
    .description('偵測連接的 MTP 裝置')
    .option('-d, --detailed', '顯示詳細裝置資訊', false)
    .action(async (options: DetectOptions) => {
      // Merge with global options
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      
      await detectCommandEnhanced({
        options: mergedOptions,
        command: 'detect',
        startTime: new Date()
      });
    });
}