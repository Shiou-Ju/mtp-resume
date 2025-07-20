/**
 * @fileoverview Edge Case Handler
 * @description Handles various edge cases and boundary conditions
 */

import { promises as fs } from 'fs';
import { createLogger } from './logger';

/**
 * Edge case validation results
 */
interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

/**
 * Edge case handler for common boundary conditions
 */
export class EdgeCaseHandler {
  private logger: ReturnType<typeof createLogger>;

  constructor(options: { useColor?: boolean; verbose?: boolean } = {}) {
    this.logger = createLogger(options);
  }

  /**
   * Validate path edge cases
   */
  async validatePath(path: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      warnings: [],
      errors: [],
      suggestions: []
    };

    // Check for common path issues
    if (!path || path.trim() === '') {
      result.valid = false;
      result.errors.push('路徑不能為空');
      return result;
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(path)) {
      result.valid = false;
      result.errors.push('路徑包含無效字元');
      result.suggestions.push('移除特殊字元: < > : " | ? * 或控制字元');
    }

    // Check for path traversal attempts
    if (path.includes('..') || path.includes('//')) {
      result.warnings.push('路徑可能包含路徑遍歷嘗試');
      result.suggestions.push('使用絕對路徑以避免安全問題');
    }

    // Check path length (most filesystems have limits)
    if (path.length > 260) {
      result.warnings.push('路徑過長，可能在某些系統上失敗');
      result.suggestions.push('縮短路徑長度或使用符號連結');
    }

    // Check if path exists
    try {
      const stats = await fs.stat(path);
      
      // Check permissions
      try {
        await fs.access(path, fs.constants.R_OK);
      } catch {
        result.warnings.push('可能無法讀取此路徑');
        result.suggestions.push('檢查檔案權限設定');
      }

      // Warn about very large directories
      if (stats.isDirectory()) {
        try {
          const files = await fs.readdir(path);
          if (files.length > 10000) {
            result.warnings.push('目錄包含大量檔案，操作可能較慢');
            result.suggestions.push('考慮使用篩選選項或分批處理');
          }
        } catch {
          // Ignore readdir errors, just skip this check
        }
      }

      // Warn about very large files
      if (stats.isFile() && stats.size > 1024 * 1024 * 1024) { // 1GB
        result.warnings.push('檔案較大，傳輸可能需要較長時間');
        result.suggestions.push('確保有穩定的連接和足夠的耐心');
      }

    } catch (error) {
      result.valid = false;
      result.errors.push('無法存取指定路徑');
      result.suggestions.push('確認路徑存在且有適當權限');
    }

    return result;
  }

  /**
   * Validate command options edge cases
   */
  validateOptions(options: Record<string, any>): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      warnings: [],
      errors: [],
      suggestions: []
    };

    // Check for conflicting options
    if (options.json && options.verbose) {
      result.warnings.push('JSON 輸出與詳細模式可能產生混合輸出');
      result.suggestions.push('建議只使用其中一個選項');
    }

    if (options.noColor && options.verbose) {
      result.warnings.push('無色彩模式與詳細模式組合可能降低可讀性');
    }

    // Check for resource-intensive combinations
    if (options.concurrency && parseInt(options.concurrency) > 10) {
      result.warnings.push('過高的並行數可能導致系統過載');
      result.suggestions.push('建議使用較低的並行數 (1-5)');
    }

    // Check for potentially problematic patterns
    if (options.filter && options.exclude) {
      result.warnings.push('同時使用篩選和排除可能產生意外結果');
      result.suggestions.push('仔細測試篩選條件以確保符合預期');
    }

    // Validate timeout values
    if (options.timeout && (isNaN(options.timeout) || options.timeout < 0)) {
      result.valid = false;
      result.errors.push('逾時值必須是正數');
    }

    return result;
  }

  /**
   * Validate system resources
   */
  async validateSystemResources(): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      warnings: [],
      errors: [],
      suggestions: []
    };

    try {
      // Check available disk space
      await fs.stat('.');
      // Note: This is simplified - would need platform-specific code for real disk space check
      
      // Check memory usage (simplified)
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
        result.warnings.push('記憶體使用量較高');
        result.suggestions.push('考慮重啟程式或減少並行操作');
      }

      // Check system load (where available)
      if (process.platform === 'linux' || process.platform === 'darwin') {
        try {
          const loadavg = require('os').loadavg();
          if (loadavg[0] > 4) {
            result.warnings.push('系統負載較高');
            result.suggestions.push('等待系統負載降低後再執行大型操作');
          }
        } catch {
          // Ignore load average check on unsupported systems
        }
      }

    } catch (error) {
      result.warnings.push('無法檢查系統資源狀態');
    }

    return result;
  }

  /**
   * Handle network-related edge cases
   */
  validateNetworkConditions(): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      warnings: [],
      errors: [],
      suggestions: []
    };

    // Check for potential connection issues
    const userAgent = process.env.USER_AGENT;
    if (userAgent && userAgent.includes('CI')) {
      result.warnings.push('在 CI 環境中執行，網路條件可能不穩定');
      result.suggestions.push('增加重試次數和逾時時間');
    }

    // Check for proxy settings that might interfere
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    if (httpProxy) {
      result.warnings.push('偵測到代理設定，可能影響 USB 連接');
      result.suggestions.push('如果遇到連接問題，請暫時停用代理');
    }

    return result;
  }

  /**
   * Comprehensive edge case validation
   */
  async validateAll(options: {
    paths?: string[];
    commandOptions?: Record<string, any>;
    checkSystem?: boolean;
    checkNetwork?: boolean;
  }): Promise<ValidationResult> {
    const allResults: ValidationResult[] = [];

    // Validate paths
    if (options.paths) {
      for (const path of options.paths) {
        const pathResult = await this.validatePath(path);
        allResults.push(pathResult);
      }
    }

    // Validate command options
    if (options.commandOptions) {
      const optionsResult = this.validateOptions(options.commandOptions);
      allResults.push(optionsResult);
    }

    // Validate system resources
    if (options.checkSystem) {
      const systemResult = await this.validateSystemResources();
      allResults.push(systemResult);
    }

    // Validate network conditions
    if (options.checkNetwork) {
      const networkResult = this.validateNetworkConditions();
      allResults.push(networkResult);
    }

    // Combine all results
    const combined: ValidationResult = {
      valid: allResults.every(r => r.valid),
      warnings: allResults.flatMap(r => r.warnings),
      errors: allResults.flatMap(r => r.errors),
      suggestions: allResults.flatMap(r => r.suggestions)
    };

    // Remove duplicates
    combined.warnings = [...new Set(combined.warnings)];
    combined.errors = [...new Set(combined.errors)];
    combined.suggestions = [...new Set(combined.suggestions)];

    // Log results if there are issues
    if (!combined.valid || combined.warnings.length > 0) {
      this.logValidationResults(combined);
    }

    return combined;
  }

  /**
   * Log validation results
   */
  private logValidationResults(result: ValidationResult): void {
    if (result.errors.length > 0) {
      this.logger.error('發現驗證錯誤:');
      result.errors.forEach(error => this.logger.error(`  - ${error}`));
    }

    if (result.warnings.length > 0) {
      this.logger.warn('發現潛在問題:');
      result.warnings.forEach(warning => this.logger.warn(`  - ${warning}`));
    }

    if (result.suggestions.length > 0) {
      console.log('\n💡 建議:');
      result.suggestions.forEach(suggestion => {
        console.log(`  - ${suggestion}`);
      });
    }
  }
}

/**
 * Create edge case handler instance
 */
export function createEdgeCaseHandler(options?: { useColor?: boolean; verbose?: boolean }): EdgeCaseHandler {
  return new EdgeCaseHandler(options);
}

/**
 * Quick validation function
 */
export async function validateEdgeCases(options: {
  paths?: string[];
  commandOptions?: Record<string, any>;
  checkSystem?: boolean;
  checkNetwork?: boolean;
}): Promise<boolean> {
  const handler = createEdgeCaseHandler();
  const result = await handler.validateAll(options);
  return result.valid;
}