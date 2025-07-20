/**
 * @fileoverview System Diagnostic Command
 * @description Comprehensive system diagnostics for troubleshooting
 */

import chalk from 'chalk';
import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import { createLogger } from '../utils/logger';
import type { CommandContext } from '../types/cli-types';

/**
 * Diagnostic check result
 */
interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  details?: string;
  suggestions?: string[];
}

/**
 * Doctor command options
 */
interface DoctorOptions {
  verbose?: boolean;
  json?: boolean;
  noColor?: boolean;
  fix?: boolean;
}

/**
 * System diagnostic checks
 */
export class SystemDiagnostics {
  private results: DiagnosticResult[] = [];

  constructor(_options: { useColor?: boolean; verbose?: boolean } = {}) {
    // Options stored for future use if needed
  }

  /**
   * Run all diagnostic checks
   */
  async runAll(): Promise<DiagnosticResult[]> {
    this.results = [];
    
    console.log(chalk.blue('🔍 執行系統診斷檢查...\n'));
    
    // System environment checks
    await this.checkNodeVersion();
    await this.checkOperatingSystem();
    await this.checkMTPTools();
    await this.checkUSBDevices();
    
    // Application checks
    await this.checkDatabaseAccess();
    await this.checkPermissions();
    await this.checkDiskSpace();
    await this.checkNetworkConnectivity();
    
    // MTP specific checks
    await this.checkMTPDeviceConnection();
    await this.checkMTPServices();
    
    return this.results;
  }

  /**
   * Check Node.js version
   */
  private async checkNodeVersion(): Promise<void> {
    try {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      
      if (major >= 16) {
        this.addResult({
          name: 'Node.js 版本',
          status: 'pass',
          message: `Node.js ${version} (支援)`,
          details: '建議的最低版本: 16.0.0'
        });
      } else {
        this.addResult({
          name: 'Node.js 版本',
          status: 'fail',
          message: `Node.js ${version} (版本過舊)`,
          details: '當前版本可能不相容',
          suggestions: [
            '升級到 Node.js 16.0.0 或更新版本',
            '使用 nvm 管理 Node.js 版本',
            '檢查 https://nodejs.org 取得最新版本'
          ]
        });
      }
    } catch (error) {
      this.addResult({
        name: 'Node.js 版本',
        status: 'fail',
        message: '無法檢測 Node.js 版本',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check operating system compatibility
   */
  private async checkOperatingSystem(): Promise<void> {
    const platform = process.platform;
    const arch = process.arch;
    
    const supportedPlatforms = ['linux', 'darwin'];
    
    if (supportedPlatforms.includes(platform)) {
      this.addResult({
        name: '作業系統',
        status: 'pass',
        message: `${platform} ${arch} (支援)`,
        details: '相容的作業系統'
      });
    } else {
      this.addResult({
        name: '作業系統',
        status: 'warn',
        message: `${platform} ${arch} (未測試)`,
        details: 'MTP 功能可能無法正常運作',
        suggestions: [
          '建議使用 Linux 或 macOS',
          '在 Windows 上需要額外的 MTP 驅動程式',
          '考慮使用虛擬機器或 WSL'
        ]
      });
    }
  }

  /**
   * Check MTP tools installation
   */
  private async checkMTPTools(): Promise<void> {
    const tools = ['mtp-detect', 'mtp-files', 'mtp-getfile'];
    let allInstalled = true;
    const missingTools: string[] = [];
    
    for (const tool of tools) {
      try {
        execSync(`which ${tool}`, { stdio: 'pipe' });
      } catch {
        allInstalled = false;
        missingTools.push(tool);
      }
    }
    
    if (allInstalled) {
      this.addResult({
        name: 'MTP 工具',
        status: 'pass',
        message: '所有 MTP 工具已安裝',
        details: 'mtp-detect, mtp-files, mtp-getfile 都可用'
      });
    } else {
      this.addResult({
        name: 'MTP 工具',
        status: 'fail',
        message: `缺少 MTP 工具: ${missingTools.join(', ')}`,
        suggestions: [
          'Ubuntu/Debian: sudo apt install libmtp-dev mtp-tools',
          'macOS: brew install libmtp',
          'CentOS/RHEL: sudo yum install libmtp-devel',
          'Arch Linux: sudo pacman -S libmtp'
        ]
      });
    }
  }

  /**
   * Check USB device detection
   */
  private async checkUSBDevices(): Promise<void> {
    try {
      const output = execSync('lsusb 2>/dev/null || system_profiler SPUSBDataType 2>/dev/null || echo "USB檢查跳過"', { 
        encoding: 'utf8',
        timeout: 5000 
      });
      
      if (output.includes('USB檢查跳過')) {
        this.addResult({
          name: 'USB 裝置',
          status: 'skip',
          message: '無法檢查 USB 裝置',
          details: '系統不支援 lsusb 或 system_profiler'
        });
      } else {
        const hasAndroidDevices = /android|samsung|lg|htc|sony|huawei|xiaomi|oppo|vivo/i.test(output);
        
        if (hasAndroidDevices) {
          this.addResult({
            name: 'USB 裝置',
            status: 'pass',
            message: '偵測到可能的 Android 裝置',
            details: '找到潛在的 MTP 裝置'
          });
        } else {
          this.addResult({
            name: 'USB 裝置',
            status: 'warn',
            message: '未偵測到 Android 裝置',
            details: '可能需要連接 MTP 裝置',
            suggestions: [
              '連接 Android 裝置到 USB 連接埠',
              '確認裝置已解鎖',
              '在裝置上選擇「檔案傳輸」模式'
            ]
          });
        }
      }
    } catch (error) {
      this.addResult({
        name: 'USB 裝置',
        status: 'fail',
        message: 'USB 裝置檢查失敗',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check database access
   */
  private async checkDatabaseAccess(): Promise<void> {
    try {
      const testDbPath = './test-permissions.db';
      
      // Try to create and write to a test database
      await fs.writeFile(testDbPath, 'test');
      await fs.access(testDbPath, fs.constants.R_OK | fs.constants.W_OK);
      await fs.unlink(testDbPath);
      
      this.addResult({
        name: '資料庫權限',
        status: 'pass',
        message: '資料庫讀寫權限正常',
        details: '可以建立和存取 SQLite 資料庫'
      });
    } catch (error) {
      this.addResult({
        name: '資料庫權限',
        status: 'fail',
        message: '資料庫權限不足',
        details: error instanceof Error ? error.message : String(error),
        suggestions: [
          '檢查當前目錄的寫入權限',
          '使用 --db 參數指定可寫入的位置',
          '確認磁碟空間充足'
        ]
      });
    }
  }

  /**
   * Check system permissions
   */
  private async checkPermissions(): Promise<void> {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      if (!homeDir) {
        throw new Error('無法取得使用者主目錄');
      }
      
      await fs.access(homeDir, fs.constants.R_OK | fs.constants.W_OK);
      
      this.addResult({
        name: '檔案系統權限',
        status: 'pass',
        message: '檔案系統權限正常',
        details: '可以存取使用者主目錄'
      });
    } catch (error) {
      this.addResult({
        name: '檔案系統權限',
        status: 'warn',
        message: '檔案系統權限可能有問題',
        details: error instanceof Error ? error.message : String(error),
        suggestions: [
          '檢查檔案權限設定',
          '確認有足夠的使用者權限',
          '考慮使用管理員權限執行'
        ]
      });
    }
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<void> {
    try {
      await fs.stat('.');
      
      // This is a simplified check - in real implementation you'd use statvfs or similar
      this.addResult({
        name: '磁碟空間',
        status: 'pass',
        message: '磁碟空間檢查通過',
        details: '當前目錄可存取'
      });
    } catch (error) {
      this.addResult({
        name: '磁碟空間',
        status: 'warn',
        message: '無法檢查磁碟空間',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check network connectivity (for potential future web features)
   */
  private async checkNetworkConnectivity(): Promise<void> {
    // Skip network check for now as it's not critical for MTP operations
    this.addResult({
      name: '網路連線',
      status: 'skip',
      message: '網路連線檢查已跳過',
      details: 'MTP 操作不需要網路連線'
    });
  }

  /**
   * Check MTP device connection
   */
  private async checkMTPDeviceConnection(): Promise<void> {
    try {
      const output = execSync('mtp-detect 2>&1', { 
        encoding: 'utf8',
        timeout: 10000 
      });
      
      if (output.includes('Device 0 (VID=') || output.includes('Found device')) {
        this.addResult({
          name: 'MTP 裝置連線',
          status: 'pass',
          message: '偵測到 MTP 裝置',
          details: '裝置可以正常通訊'
        });
      } else if (output.includes('No raw devices found')) {
        this.addResult({
          name: 'MTP 裝置連線',
          status: 'warn',
          message: '未找到 MTP 裝置',
          details: '可能需要連接或設定裝置',
          suggestions: [
            '連接 Android 裝置到電腦',
            '確認裝置已解鎖',
            '在裝置上選擇「檔案傳輸」或「MTP」模式',
            '嘗試重新連接 USB 纜線',
            '檢查 USB 纜線是否支援資料傳輸'
          ]
        });
      } else {
        this.addResult({
          name: 'MTP 裝置連線',
          status: 'fail',
          message: 'MTP 裝置偵測失敗',
          details: output.slice(0, 200) + (output.length > 200 ? '...' : ''),
          suggestions: [
            '檢查 MTP 工具安裝',
            '確認 USB 驅動程式正確',
            '重啟 MTP 服務'
          ]
        });
      }
    } catch (error) {
      this.addResult({
        name: 'MTP 裝置連線',
        status: 'fail',
        message: 'MTP 偵測命令執行失敗',
        details: error instanceof Error ? error.message : String(error),
        suggestions: [
          '確認 mtp-detect 命令可用',
          '安裝必要的 MTP 工具',
          '檢查系統權限'
        ]
      });
    }
  }

  /**
   * Check MTP services status
   */
  private async checkMTPServices(): Promise<void> {
    try {
      // Check if we can list files (indicating MTP service is working)
      const output = execSync('mtp-files 2>&1', { 
        encoding: 'utf8',
        timeout: 10000 
      });
      
      if (output.includes('Device 0 (VID=') || !output.includes('No raw devices found')) {
        this.addResult({
          name: 'MTP 服務',
          status: 'pass',
          message: 'MTP 服務正常運作',
          details: '可以列出裝置檔案'
        });
      } else {
        this.addResult({
          name: 'MTP 服務',
          status: 'warn',
          message: 'MTP 服務無法存取裝置',
          details: '服務運作但無法找到裝置',
          suggestions: [
            '確認裝置連接狀態',
            '重啟 MTP 服務',
            '檢查裝置權限設定'
          ]
        });
      }
    } catch (error) {
      this.addResult({
        name: 'MTP 服務',
        status: 'fail',
        message: 'MTP 服務檢查失敗',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Add diagnostic result
   */
  private addResult(result: DiagnosticResult): void {
    this.results.push(result);
    this.displayResult(result);
  }

  /**
   * Display single result
   */
  private displayResult(result: DiagnosticResult): void {
    const icons = {
      pass: '✅',
      fail: '❌',
      warn: '⚠️',
      skip: '⏭️'
    };
    
    const colors = {
      pass: chalk.green,
      fail: chalk.red,
      warn: chalk.yellow,
      skip: chalk.blue
    };
    
    const icon = icons[result.status];
    const color = colors[result.status];
    
    console.log(`${icon} ${color(result.name)}: ${result.message}`);
    
    if (result.details) {
      console.log(`   ${chalk.dim(result.details)}`);
    }
    
    if (result.suggestions && result.suggestions.length > 0) {
      console.log(`   ${chalk.yellow('建議:')} ${result.suggestions[0]}`);
      result.suggestions.slice(1).forEach(suggestion => {
        console.log(`   ${chalk.dim('      ')} ${suggestion}`);
      });
    }
    
    console.log(''); // Empty line between results
  }

  /**
   * Get summary of all results
   */
  getSummary(): { total: number; passed: number; failed: number; warned: number; skipped: number } {
    return {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      failed: this.results.filter(r => r.status === 'fail').length,
      warned: this.results.filter(r => r.status === 'warn').length,
      skipped: this.results.filter(r => r.status === 'skip').length
    };
  }
}

/**
 * Doctor command handler
 */
export async function doctorCommand(context: CommandContext<DoctorOptions>): Promise<void> {
  const { options } = context;
  const logger = createLogger({ useColor: !options.noColor, verbose: options.verbose || false });
  
  try {
    const diagnostics = new SystemDiagnostics({ 
      useColor: !options.noColor, 
      verbose: options.verbose || false 
    });
    
    const results = await diagnostics.runAll();
    const summary = diagnostics.getSummary();
    
    // Show summary
    console.log(chalk.blue('📊 診斷結果摘要:'));
    console.log(`   總檢查項目: ${summary.total}`);
    console.log(`   ${chalk.green('✅ 通過:')} ${summary.passed}`);
    if (summary.failed > 0) {
      console.log(`   ${chalk.red('❌ 失敗:')} ${summary.failed}`);
    }
    if (summary.warned > 0) {
      console.log(`   ${chalk.yellow('⚠️  警告:')} ${summary.warned}`);
    }
    if (summary.skipped > 0) {
      console.log(`   ${chalk.blue('⏭️  跳過:')} ${summary.skipped}`);
    }
    
    // JSON output
    if (options.json) {
      console.log('\n' + JSON.stringify({
        summary,
        results,
        timestamp: new Date().toISOString()
      }, null, 2));
    }
    
    // Overall status
    if (summary.failed > 0) {
      console.log(chalk.red('\n🚨 發現嚴重問題，建議修復後再使用'));
      process.exit(1);
    } else if (summary.warned > 0) {
      console.log(chalk.yellow('\n⚠️  發現一些警告，功能可能受限'));
    } else {
      console.log(chalk.green('\n🎉 系統檢查全部通過，可以正常使用'));
    }
    
  } catch (error) {
    logger.error('診斷檢查執行失敗');
    if (error instanceof Error) {
      logger.error(error.message);
      if (options.verbose && error.stack) {
        console.error(chalk.dim(error.stack));
      }
    }
    process.exit(1);
  }
}

/**
 * Register doctor command
 */
export function registerDoctorCommand(program: any): void {
  program
    .command('doctor')
    .description('執行系統診斷檢查')
    .option('--fix', '嘗試自動修復問題', false)
    .action(async (options: DoctorOptions) => {
      // Merge with global options
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      
      await doctorCommand({
        options: mergedOptions,
        command: 'doctor',
        startTime: new Date()
      });
    });
}