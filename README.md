# mtp-resume
 MTP 檔案傳輸工具，解決部分套件傳輸大量檔案時卡住的問題

## MTP 續傳工具開發文檔

### 專案概述
開發一個穩定可靠的 MTP 檔案傳輸工具，解決 OpenMTP 傳輸大量檔案時卡住的問題，並提供智慧續傳功能。

### 核心功能
- **智慧續傳**：記錄傳輸進度，支援斷點續傳
- **穩定傳輸**：能處理大檔案和錯誤情況
- **雙介面支援**：CLI 快速操作，GUI 友善介面

### 技術架構

#### Monorepo 結構
```
mtp-transfer/
├── packages/
│   ├── core/              # 核心邏輯套件
│   │   ├── src/
│   │   │   ├── mtp-wrapper.js     # MTP 操作封裝
│   │   │   ├── transfer-manager.js # 傳輸管理
│   │   │   ├── database.js        # 資料庫操作
│   │   │   └── file-differ.js     # 檔案比對邏輯
│   │   └── package.json
│   │
│   ├── cli/               # CLI 介面
│   │   ├── src/
│   │   │   └── index.js
│   │   └── package.json
│   │
│   └── gui/               # GUI 介面 (未來開發)
│       └── package.json
│
├── pnpm-workspace.yaml
└── package.json
```

#### pnpm-workspace.yaml
```yaml
packages:
  - 'packages/*'
```

### 資料庫設計

```sql
-- 簡化的傳輸記錄表
CREATE TABLE transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(file_path, file_size)
);

CREATE INDEX idx_status ON transfers(status);
CREATE INDEX idx_file_path ON transfers(file_path);
```

### 核心模組設計

#### 1. MTP Wrapper (packages/core/src/mtp-wrapper.js)
```javascript
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class MTPWrapper {
  async detectDevice() {
    try {
      const { stdout } = await execAsync('mtp-detect');
      return this.parseDeviceInfo(stdout);
    } catch (error) {
      throw new Error(`裝置偵測失敗: ${error.message}`);
    }
  }

  async listFiles() {
    const { stdout } = await execAsync('mtp-files');
    return this.parseFileList(stdout);
  }

  async downloadFile(fileId, destination) {
    await execAsync(`mtp-getfile ${fileId} "${destination}"`);
  }

  parseFileList(output) {
    // 解析 mtp-files 輸出
    // 回傳格式: [{ id, path, size }]
  }
}

module.exports = MTPWrapper;
```

#### 2. Transfer Manager (packages/core/src/transfer-manager.js)
```javascript
class TransferManager {
  constructor({ db, onProgress, onError }) {
    this.db = db;
    this.onProgress = onProgress || (() => {});
    this.onError = onError || (() => {});
  }

  async getPendingFiles(phoneFiles) {
    const pending = [];
    
    for (const file of phoneFiles) {
      const record = this.db.prepare(
        'SELECT status FROM transfers WHERE file_path = ? AND file_size = ?'
      ).get(file.path, file.size);
      
      if (!record || record.status !== 'completed') {
        pending.push(file);
      }
    }
    
    return pending;
  }

  async transferFile(file, destination) {
    try {
      // 更新狀態為傳輸中
      this.updateStatus(file.path, file.size, 'transferring');
      
      // 執行傳輸
      await this.mtp.downloadFile(file.id, destination);
      
      // 標記完成
      this.updateStatus(file.path, file.size, 'completed');
      
      // 通知進度
      this.onProgress({
        file: file.path,
        status: 'completed'
      });
    } catch (error) {
      this.updateStatus(file.path, file.size, 'failed', error.message);
      this.onError({ file: file.path, error });
    }
  }

  updateStatus(filePath, fileSize, status, error = null) {
    this.db.prepare(`
      INSERT OR REPLACE INTO transfers 
      (file_path, file_size, status, error, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(filePath, fileSize, status, error);
  }
}

module.exports = TransferManager;
```

#### 3. 資料庫管理 (packages/core/src/database.js)
```javascript
const Database = require('better-sqlite3');
const path = require('path');

class TransferDatabase {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(file_path, file_size)
      );
      
      CREATE INDEX IF NOT EXISTS idx_status ON transfers(status);
      CREATE INDEX IF NOT EXISTS idx_file_path ON transfers(file_path);
    `);
  }

  exportToCSV(outputPath) {
    const records = this.db.prepare('SELECT * FROM transfers').all();
    // 實作 CSV 匯出邏輯
  }

  getStatistics() {
    return {
      total: this.db.prepare('SELECT COUNT(*) as count FROM transfers').get().count,
      completed: this.db.prepare('SELECT COUNT(*) as count FROM transfers WHERE status = ?').get('completed').count,
      failed: this.db.prepare('SELECT COUNT(*) as count FROM transfers WHERE status = ?').get('failed').count,
      pending: this.db.prepare('SELECT COUNT(*) as count FROM transfers WHERE status = ?').get('pending').count
    };
  }
}

module.exports = TransferDatabase;
```

### CLI 實作 (packages/cli/src/index.js)

```javascript
#!/usr/bin/env node
const { Command } = require('commander');
const chalk = require('chalk');
const cliProgress = require('cli-progress');
const { MTPWrapper, TransferManager, TransferDatabase } = require('@mtp-transfer/core');

const program = new Command();

program
  .name('mtp-transfer')
  .description('智慧 MTP 檔案傳輸工具')
  .version('1.0.0');

program
  .command('detect')
  .description('偵測 MTP 裝置')
  .action(async () => {
    const mtp = new MTPWrapper();
    try {
      const device = await mtp.detectDevice();
      console.log(chalk.green('✓ 找到裝置:'), device);
    } catch (error) {
      console.error(chalk.red('✗ 偵測失敗:'), error.message);
    }
  });

program
  .command('transfer <destination>')
  .description('開始傳輸檔案')
  .option('-f, --filter <pattern>', '檔案篩選 (例如: *.jpg)')
  .option('-d, --db <path>', '資料庫路徑', './transfer.db')
  .action(async (destination, options) => {
    const db = new TransferDatabase(options.db);
    const mtp = new MTPWrapper();
    
    // 建立進度條
    const progressBar = new cliProgress.SingleBar({
      format: '進度 |{bar}| {percentage}% | {value}/{total} 檔案 | {file}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591'
    });
    
    const manager = new TransferManager({
      db: db.db,
      onProgress: (data) => {
        progressBar.increment(1, { file: data.file });
      },
      onError: (data) => {
        console.error(chalk.red(`\n✗ 傳輸失敗: ${data.file}`));
      }
    });
    
    try {
      // 取得檔案列表
      console.log(chalk.blue('正在掃描檔案...'));
      const phoneFiles = await mtp.listFiles();
      
      // 取得待傳輸檔案
      const pendingFiles = await manager.getPendingFiles(phoneFiles);
      console.log(chalk.green(`找到 ${pendingFiles.length} 個待傳輸檔案`));
      
      // 開始傳輸
      progressBar.start(pendingFiles.length, 0);
      
      for (const file of pendingFiles) {
        await manager.transferFile(file, destination);
      }
      
      progressBar.stop();
      console.log(chalk.green('\n✓ 傳輸完成！'));
      
      // 顯示統計
      const stats = db.getStatistics();
      console.log(chalk.blue('\n統計資訊:'));
      console.log(`  總檔案數: ${stats.total}`);
      console.log(`  已完成: ${stats.completed}`);
      console.log(`  失敗: ${stats.failed}`);
      
    } catch (error) {
      console.error(chalk.red('✗ 錯誤:'), error.message);
    }
  });

program
  .command('export <output>')
  .description('匯出傳輸記錄')
  .action(async (output) => {
    const db = new TransferDatabase('./transfer.db');
    await db.exportToCSV(output);
    console.log(chalk.green(`✓ 已匯出至 ${output}`));
  });

program.parse();
```

### 安裝與使用

#### 初始化專案
```bash
# 建立專案
mkdir mtp-transfer && cd mtp-transfer

# 初始化 pnpm
pnpm init

# 設定 workspace
echo "packages:\n  - 'packages/*'" > pnpm-workspace.yaml

# 建立套件目錄
mkdir -p packages/core/src packages/cli/src

# 安裝依賴
cd packages/core && pnpm init && pnpm add better-sqlite3
cd ../cli && pnpm init && pnpm add commander chalk cli-progress
pnpm add -D @mtp-transfer/core@workspace:*
```

#### 使用範例
```bash
# 偵測裝置
mtp-transfer detect

# 開始傳輸
mtp-transfer transfer ~/Pictures/Phone

# 只傳輸照片
mtp-transfer transfer ~/Pictures/Phone --filter "*.jpg"

# 匯出記錄
mtp-transfer export transfer-log.csv
```

### 開發階段

#### Phase 1: 核心功能
- 建立 monorepo 結構
- 實作 MTP wrapper
- 建立資料庫模組
- 完成檔案比對邏輯

#### Phase 2: CLI 介面
- 實作基本命令
- 加入進度顯示
- 錯誤處理機制
- 統計資訊顯示

#### Phase 3: 進階功能
- 檔案篩選功能
- 批次處理優化
- 自動重試機制
- 記錄匯出功能

#### Phase 4: GUI 開發 (未來)
- Electron 應用程式
- 視覺化進度顯示
- 拖放介面
- 設定管理

### 預期成果
- 穩定傳輸 2000+ 檔案
- 支援斷點續傳
- 清晰的進度回饋
- 可匯出傳輸記錄
