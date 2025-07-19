/**
 * @fileoverview Enhanced List Command Implementation
 * @description List MTP device files with rich feedback
 */

import { MTPWrapper } from '@mtp-transfer/core';
import type { CommandContext, ListOptions } from '../types/cli-types';
import { createUserFeedback } from '../utils/feedback';
import { AnimatedTransition, LoadingAnimation } from '../utils/animations';
import { formatBytes, formatDate } from '../utils/formatter';
import type { MTPFile } from '@mtp-transfer/core';

/**
 * Enhanced list command handler
 */
export async function listCommandEnhanced(context: CommandContext<ListOptions>): Promise<void> {
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
    
    // Detect device
    const device = await mtp.detectDevice();
    
    if (!device || !device.connected) {
      feedback.completeStage(false);
      feedback.showError('未找到 MTP 裝置');
      process.exit(1);
    }
    
    feedback.completeStage(true, `找到裝置: ${device.model}`);
    
    // Start scanning stage
    feedback.startStage('scanning');
    
    let scannedCount = 0;
    const scanAnimation = setInterval(() => {
      feedback.updateStage('掃描檔案', scannedCount);
    }, 100);
    
    // List files
    const path = options.path || '/';
    let files: MTPFile[] = [];
    
    try {
      files = await mtp.listFiles(path, {
        recursive: options.recursive || false
      });
      scannedCount = files.length;
    } finally {
      clearInterval(scanAnimation);
    }
    
    feedback.completeStage(true, `掃描完成，找到 ${files.length} 個項目`);
    
    // Filter files if needed
    if (options.filter) {
      const filterRegex = new RegExp(options.filter, 'i');
      files = files.filter(file => filterRegex.test(file.name));
      
      if (files.length === 0) {
        feedback.showWarning(`沒有符合篩選條件 "${options.filter}" 的檔案`);
      }
    }
    
    // Sort files
    if (options.sort) {
      files = sortFiles(files, options.sort);
    }
    
    // Output result
    if (options.json) {
      // JSON output
      console.log(JSON.stringify({
        success: true,
        path,
        count: files.length,
        files: files.map(file => ({
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          modifiedDate: file.modifiedTime,
          path: file.path
        })),
        timestamp: new Date().toISOString()
      }, null, 2));
    } else {
      // Rich display output
      if (files.length === 0) {
        feedback.showInfo('資料夾是空的');
      } else {
        // Show path with animation
        await AnimatedTransition.fadeIn(`📁 ${path}`, 300);
        console.log('');
        
        // Display files
        if (options.detailed) {
          displayDetailedFiles(files);
        } else {
          displaySimpleFiles(files);
        }
        
        // Show summary
        const stats = calculateStats(files);
        feedback.showScanResults({
          totalFiles: stats.fileCount,
          totalSize: formatBytes(stats.totalSize),
          newFiles: 0, // Not applicable for list
          modifiedFiles: 0, // Not applicable for list
          duplicateFiles: 0 // Not applicable for list
        });
        
        // Show storage usage if at root
        if (path === '/') {
          const stopAnimation = LoadingAnimation.pulse('計算儲存空間使用...');
          await new Promise(resolve => setTimeout(resolve, 500));
          stopAnimation();
          
          try {
            const deviceInfo = await mtp.getDeviceInfo();
            if (deviceInfo?.storageInfo?.[0]) {
              const storage = deviceInfo.storageInfo[0];
              const usedPercentage = Math.round((storage.usedSpace / storage.totalSpace) * 100);
              
              console.log('\n📊 儲存空間使用:');
              console.log(createStorageBar(usedPercentage));
              console.log(`已使用: ${formatBytes(storage.usedSpace)} / ${formatBytes(storage.totalSpace)} (${usedPercentage}%)`);
            }
          } catch (error) {
            // Ignore storage info errors
          }
        }
      }
      
      // Show tips
      feedback.showTips([
        `使用 'mtp-transfer list <路徑>' 查看特定資料夾`,
        options.recursive ? '' : `使用 '--recursive' 遞迴列出所有子資料夾`,
        `使用 '--filter <模式>' 篩選檔案`,
        `使用 'mtp-transfer get <檔案ID>' 下載檔案`
      ].filter(Boolean));
    }
    
  } catch (error) {
    feedback.completeStage(false);
    
    if (error instanceof Error) {
      feedback.showError(error, options.verbose ? error.stack : undefined);
    } else {
      feedback.showError('未知錯誤');
    }
    
    process.exit(1);
  }
}

/**
 * Display files in simple format
 */
function displaySimpleFiles(files: MTPFile[]): void {
  const folders = files.filter(f => f.type === 'folder');
  const regularFiles = files.filter(f => f.type !== 'folder');
  
  // Display folders first
  if (folders.length > 0) {
    console.log('📁 資料夾:');
    folders.forEach(folder => {
      console.log(`  ${folder.name}/`);
    });
    console.log('');
  }
  
  // Display files
  if (regularFiles.length > 0) {
    console.log('📄 檔案:');
    regularFiles.forEach(file => {
      const size = formatBytes(file.size);
      console.log(`  ${file.name} (${size})`);
    });
  }
}

/**
 * Display files in detailed format
 */
function displayDetailedFiles(files: MTPFile[]): void {
  // Create table header
  console.log('ID      類型    大小          修改時間              名稱');
  console.log('─'.repeat(80));
  
  files.forEach(file => {
    const type = file.type === 'folder' ? '📁' : '📄';
    const size = file.type === 'folder' ? '     -    ' : formatBytes(file.size).padEnd(10);
    const date = formatDate(file.modifiedTime);
    const id = String(file.id).padEnd(6);
    
    console.log(`${id}  ${type}    ${size}  ${date}  ${file.name}`);
  });
}

/**
 * Sort files
 */
function sortFiles(files: MTPFile[], sortBy: string): MTPFile[] {
  const sorted = [...files];
  
  switch (sortBy) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'size':
      sorted.sort((a, b) => b.size - a.size);
      break;
    case 'date':
      sorted.sort((a, b) => (b.modifiedTime?.getTime() || 0) - (a.modifiedTime?.getTime() || 0));
      break;
    case 'type':
      sorted.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      });
      break;
  }
  
  return sorted;
}

/**
 * Calculate statistics
 */
function calculateStats(files: MTPFile[]): { fileCount: number; folderCount: number; totalSize: number } {
  let fileCount = 0;
  let folderCount = 0;
  let totalSize = 0;
  
  files.forEach(file => {
    if (file.type === 'folder') {
      folderCount++;
    } else {
      fileCount++;
      totalSize += file.size;
    }
  });
  
  return { fileCount, folderCount, totalSize };
}

/**
 * Create storage usage bar
 */
function createStorageBar(percentage: number): string {
  const width = 40;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  
  return `[${bar}] ${percentage}%`;
}

/**
 * Register enhanced list command
 */
export function registerListCommandEnhanced(program: any): void {
  program
    .command('list [path]')
    .description('列出裝置檔案')
    .option('-r, --recursive', '遞迴列出所有子資料夾', false)
    .option('-d, --detailed', '顯示詳細資訊', false)
    .option('-f, --filter <pattern>', '篩選檔案 (regex)')
    .option('-s, --sort <by>', '排序方式 (name|size|date|type)', 'name')
    .action(async (path: string | undefined, options: ListOptions) => {
      // Merge with global options
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options, path };
      
      await listCommandEnhanced({
        options: mergedOptions,
        command: 'list',
        startTime: new Date()
      });
    });
}