/**
 * @fileoverview List Command Implementation
 * @description List files on MTP device
 */

// @ts-ignore
import ora from 'ora';
import { MTPWrapper } from '@mtp-transfer/core';
import type { CommandContext, ListOptions, FileDisplay } from '../types/cli-types';
import { createFormatter, formatBytes, formatDate } from '../utils/formatter';
import { createLogger } from '../utils/logger';

/**
 * List command handler
 */
export async function listCommand(
  path: string,
  context: CommandContext<ListOptions>
): Promise<void> {
  const { options } = context;
  const formatter = createFormatter(!options.noColor);
  const logger = createLogger({ useColor: !options.noColor, verbose: options.verbose || false });
  
  // Default path to root
  const targetPath = path || '/';
  
  // Show spinner while listing
  const spinner = ora({
    text: `列出檔案: ${targetPath}`,
    spinner: 'dots',
    color: 'blue'
  }).start();

  try {
    // Create MTP wrapper instance
    const mtp = new MTPWrapper({ debug: options.verbose || false });
    
    // Detect device first
    logger.debug('偵測 MTP 裝置...');
    const device = await mtp.detectDevice();
    
    if (!device || !device.connected) {
      spinner.fail('未找到 MTP 裝置');
      logger.error('請先連接 MTP 裝置');
      process.exit(1);
    }
    
    spinner.text = `列出 ${device.model} 上的檔案...`;
    
    // List files
    logger.debug(`列出路徑: ${targetPath}, 遞迴: ${options.recursive}`);
    const files = await mtp.listFiles(targetPath, {
      recursive: options.recursive || false,
      includeMetadata: true
    });
    
    spinner.succeed(`找到 ${files.length} 個項目`);
    
    // Filter hidden files if needed
    let displayFiles = files;
    if (!options.all) {
      displayFiles = files.filter(f => !f.name.startsWith('.'));
      if (displayFiles.length < files.length) {
        logger.debug(`已隱藏 ${files.length - displayFiles.length} 個隱藏檔案`);
      }
    }
    
    // Convert to display format
    const fileDisplays: FileDisplay[] = displayFiles.map(file => ({
      name: file.name,
      size: file.type === 'folder' ? '-' : formatBytes(file.size),
      date: formatDate(file.modifiedTime),
      type: file.type,
      path: file.path
    }));
    
    // Output result
    if (options.json || options.format === 'json') {
      // JSON output
      console.log(JSON.stringify({
        success: true,
        path: targetPath,
        files: displayFiles,
        count: displayFiles.length,
        timestamp: new Date().toISOString()
      }, null, 2));
    } else {
      // Formatted output
      if (fileDisplays.length === 0) {
        logger.info('目錄是空的');
      } else {
        console.log('\n' + formatter.formatFiles(fileDisplays, options));
        
        // Show summary
        const folders = displayFiles.filter(f => f.type === 'folder').length;
        const totalSize = displayFiles
          .filter(f => f.type === 'file')
          .reduce((sum, f) => sum + f.size, 0);
        
        console.log(`\n總計: ${displayFiles.length} 個項目 (${folders} 個資料夾, ${formatBytes(totalSize)})`);
      }
    }
    
    logger.debug('檔案列表完成');
    
  } catch (error) {
    spinner.fail('列出檔案失敗');
    
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('not found')) {
        logger.error(`找不到路徑: ${targetPath}`);
      } else if (error.message.includes('permission')) {
        logger.error(`沒有權限存取: ${targetPath}`);
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
 * Register list command
 */
export function registerListCommand(program: any): void {
  program
    .command('list [path]')
    .alias('ls')
    .description('列出 MTP 裝置上的檔案')
    .option('-r, --recursive', '遞迴列出子目錄', false)
    .option('-a, --all', '顯示隱藏檔案', false)
    .option('-f, --format <format>', '輸出格式: table, tree, json', 'table')
    .option('-s, --sort <field>', '排序方式: name, size, date', 'name')
    .option('--reverse', '反向排序', false)
    .action(async (path: string | undefined, options: ListOptions) => {
      // Merge with global options
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      
      await listCommand(path || '/', {
        options: mergedOptions,
        command: 'list',
        startTime: new Date()
      });
    });
}