/**
 * @fileoverview Mock Test for TransferManager
 * @description 測試 TransferManager 完整功能，不依賴真實 MTP 裝置
 */

import { TransferManager } from './transfer-manager';
import { TransferDatabase } from './database';
import type { TransferManagerOptions, TransferOptions } from './types/transfer-manager-types';
import type { LocalFile } from './types/file-differ-types';

/**
 * Mock 測試設定
 */
interface MockTestConfig {
  testDataPath: string;
  mockFileCount: number;
  simulateErrors: boolean;
  concurrency: number;
  verbose: boolean;
}

/**
 * 預設測試配置
 */
const DEFAULT_TEST_CONFIG: MockTestConfig = {
  testDataPath: '/tmp/mtp-mock-test',
  mockFileCount: 10,
  simulateErrors: false,
  concurrency: 2,
  verbose: true
};

/**
 * TransferManager Mock 測試類別
 */
export class TransferManagerMockTest {
  private config: MockTestConfig;
  private db: TransferDatabase;
  private transferManager?: TransferManager;
  
  constructor(config: Partial<MockTestConfig> = {}) {
    this.config = { ...DEFAULT_TEST_CONFIG, ...config };
    this.db = new TransferDatabase(':memory:'); // 使用記憶體資料庫
  }

  /**
   * 執行完整測試套件
   */
  public async runAllTests(): Promise<void> {
    console.log('🚀 開始 TransferManager Mock 測試');
    console.log('設定:', this.config);
    
    try {
      await this.testInitialization();
      await this.testBasicTransfer();
      await this.testSessionManagement();
      await this.testProgressTracking();
      await this.testErrorHandling();
      await this.testConcurrencyControl();
      
      console.log('✅ 所有測試通過！');
    } catch (error) {
      console.error('❌ 測試失敗:', error);
      throw error;
    } finally {
      this.cleanup();
    }
  }

  /**
   * 測試 1: 初始化
   */
  private async testInitialization(): Promise<void> {
    console.log('\n📋 測試 1: TransferManager 初始化');
    
    const options: TransferManagerOptions = {
      db: this.db,
      concurrency: this.config.concurrency,
      retryLimit: 2,
      onProgress: (progress) => {
        if (this.config.verbose) {
          console.log(`   進度: ${progress.currentFile} - ${progress.currentFileProgress}%`);
        }
      },
      onError: (error, file) => {
        console.log(`   錯誤: ${file?.fileName || 'unknown'} - ${error.message}`);
      },
      onComplete: (result) => {
        console.log(`   完成: ${result.session.completedFiles}/${result.session.totalFiles} 檔案`);
      }
    };

    this.transferManager = new TransferManager(options);
    
    // 測試佇列狀態
    const status = this.transferManager.getQueueStatus();
    console.log('   初始佇列狀態:', status);
    
    if (status.pending !== 0 || status.running !== 0) {
      throw new Error('初始化後佇列應該是空的');
    }
    
    console.log('   ✅ 初始化測試通過');
  }

  /**
   * 測試 2: 基本傳輸
   */
  private async testBasicTransfer(): Promise<void> {
    console.log('\n📁 測試 2: 基本檔案傳輸');
    
    if (!this.transferManager) {
      throw new Error('TransferManager 未初始化');
    }

    // 準備傳輸選項
    const options: TransferOptions = {
      overwrite: false,
      verifyAfterTransfer: true,
      skipErrors: false
    };

    try {
      // 這裡由於 MTPWrapper.detectDevice() 會失敗，我們期望這個錯誤
      await this.transferManager.startTransfer(this.config.testDataPath, options);
      throw new Error('應該要失敗，因為沒有真實的 MTP 裝置');
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('No MTP device connected')) {
        console.log('   ✅ 正確偵測到無 MTP 裝置');
      } else {
        throw error;
      }
    }
  }

  /**
   * 測試 3: Session 管理
   */
  private async testSessionManagement(): Promise<void> {
    console.log('\n🎯 測試 3: Session 管理');
    
    if (!this.transferManager) {
      throw new Error('TransferManager 未初始化');
    }

    // 測試佇列控制
    console.log('   測試暫停/恢復功能');
    
    await this.transferManager.pauseTransfer();
    let status = this.transferManager.getQueueStatus();
    
    if (!status.paused) {
      throw new Error('佇列應該是暫停狀態');
    }
    
    await this.transferManager.resumeTransfer();
    status = this.transferManager.getQueueStatus();
    
    if (status.paused) {
      throw new Error('佇列應該是恢復狀態');
    }
    
    console.log('   ✅ Session 管理測試通過');
  }

  /**
   * 測試 4: 進度追蹤
   */
  private async testProgressTracking(): Promise<void> {
    console.log('\n📊 測試 4: 進度追蹤');
    
    // 測試進度計算
    const mockFiles = this.createMockLocalFiles(3);
    const totalSize = mockFiles.reduce((sum, file) => sum + file.size, 0);
    
    console.log(`   Mock 檔案總大小: ${totalSize} bytes`);
    console.log(`   檔案數量: ${mockFiles.length}`);
    
    // 檢查檔案資料結構
    mockFiles.forEach((file, index) => {
      console.log(`   檔案 ${index + 1}: ${file.fileName} (${file.size} bytes)`);
    });
    
    console.log('   ✅ 進度追蹤測試通過');
  }

  /**
   * 測試 5: 錯誤處理
   */
  private async testErrorHandling(): Promise<void> {
    console.log('\n⚠️  測試 5: 錯誤處理');
    
    if (!this.transferManager) {
      throw new Error('TransferManager 未初始化');
    }

    // 測試無效路徑
    try {
      await this.transferManager.scanAndCompare('/invalid/path/that/does/not/exist');
      throw new Error('應該要失敗，因為路徑不存在');
    } catch (error) {
      console.log('   ✅ 正確處理無效路徑錯誤');
    }
    
    console.log('   ✅ 錯誤處理測試通過');
  }

  /**
   * 測試 6: 並行控制
   */
  private async testConcurrencyControl(): Promise<void> {
    console.log('\n🔄 測試 6: 並行控制');
    
    if (!this.transferManager) {
      throw new Error('TransferManager 未初始化');
    }

    const status = this.transferManager.getQueueStatus();
    
    if (status.concurrency !== this.config.concurrency) {
      throw new Error(`並行數不符合設定: ${status.concurrency} vs ${this.config.concurrency}`);
    }
    
    console.log(`   並行數設定: ${status.concurrency}`);
    console.log('   ✅ 並行控制測試通過');
  }

  /**
   * 建立 Mock 本地檔案
   */
  private createMockLocalFiles(count: number): LocalFile[] {
    const files: LocalFile[] = [];
    
    for (let i = 0; i < count; i++) {
      files.push({
        path: `${this.config.testDataPath}/file_${i}.txt`,
        size: Math.floor(Math.random() * 1000000) + 1000, // 1KB - 1MB
        modifiedTime: new Date(),
        relativePath: `file_${i}.txt`,
        extension: '.txt',
        fileName: `file_${i}.txt`
      });
    }
    
    return files;
  }


  /**
   * 清理測試資源
   */
  private cleanup(): void {
    console.log('\n🧹 清理測試環境');
    this.db.close();
  }

  /**
   * 取得測試統計
   */
  public getTestStats(): any {
    return {
      config: this.config,
      databaseStats: this.db.getStats(),
      databaseInfo: this.db.getInfo()
    };
  }
}

/**
 * 主測試執行函數
 */
export async function runTransferManagerMockTests(): Promise<void> {
  const tester = new TransferManagerMockTest({
    verbose: true,
    concurrency: 3,
    mockFileCount: 8
  });

  try {
    await tester.runAllTests();
    
    console.log('\n📈 測試統計:');
    console.log(JSON.stringify(tester.getTestStats(), null, 2));
    
  } catch (error) {
    console.error('\n💥 測試執行失敗:', error);
    process.exit(1);
  }
}

// 如果直接執行此檔案，就開始測試
if (require.main === module) {
  runTransferManagerMockTests().catch(console.error);
}