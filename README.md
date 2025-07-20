# mtp-resume
MTP 檔案下載與備份工具，解決部分套件傳輸大量檔案時卡住的問題

## 專案概述
開發一個穩定可靠的 MTP 檔案下載工具，專門用於從手機備份檔案到電腦，解決 OpenMTP 傳輸大量檔案時卡住的問題，並提供智慧續傳功能。

⚠️ **重要說明**：本工具為單向下載工具，僅支援從手機下載檔案到電腦，不支援上傳、刪除或修改手機檔案。

## 🎯 專案特點與市場差異化

### 🔥 獨特賣點
根據市場調查，**目前沒有專門的 MTP 續傳工具**！本專案填補了重要的市場空缺：

- **專注續傳**：現有工具都沒有將續傳作為核心功能
- **CLI 優先**：大部分是 GUI 工具，CLI 工具較少且功能有限
- **跨平台**：許多工具只支援單一平台
- **簡單可靠**：不需要複雜設定、root 權限或開發者模式

### 🆚 與現有工具比較

| 工具 | 續傳功能 | CLI支援 | 批次處理 | 跨平台 | 問題 |
|------|---------|---------|----------|--------|------|
| **OpenMTP** | ❌ | ❌ | ⚠️ | ✅ | 大量檔案時卡住 |
| **android-file-transfer** | ❌ | ⚠️ | ❌ | ⚠️ | 功能有限 |
| **rsync + MTP** | ⚠️ | ✅ | ⚠️ | ✅ | 非常慢，配置複雜 |
| **gMTP** | ❌ | ❌ | ❌ | ❌ | 僅 Linux |
| **mtp-resume** | ✅ | ✅ | ✅ | ✅ | 無已知問題 |

### 🎯 目標用戶
- 需要備份手機照片/影片的使用者
- 經常遇到下載中斷的情況
- 偏好命令列操作的技術使用者
- 追求效率和可靠性的專業用戶

## 核心功能
- **智慧續傳**：記錄下載進度，支援斷點續傳
- **穩定下載**：能處理大檔案和錯誤情況
- **安全設計**：只讀模式，避免誤刪手機檔案
- **進度持久化**：SQLite 資料庫保存下載狀態
- **批次處理**：高效處理大量檔案
- **錯誤恢復**：自動跳過問題檔案，繼續下載

## 🚫 功能限制
本工具採用**安全優先**的設計理念，僅支援以下功能：

| 功能 | 支援狀況 | 說明 |
|------|---------|------|
| **瀏覽檔案** | ✅ | 可以列出手機檔案和資料夾 |
| **下載檔案** | ✅ | 從手機複製檔案到電腦 |
| **續傳功能** | ✅ | 記錄已下載檔案，支援斷點續傳 |
| **上傳檔案** | ❌ | 無法傳送檔案到手機 |
| **刪除檔案** | ❌ | 無法刪除手機上的檔案 |
| **移動/重命名** | ❌ | 無法修改手機檔案結構 |
| **建立資料夾** | ❌ | 無法在手機建立新資料夾 |

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
  .description('智慧 MTP 檔案下載與備份工具')
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
  .description('從 MTP 裝置下載檔案')
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

# 下載所有檔案到指定資料夾
mtp-transfer transfer ~/Pictures/Phone-Backup

# 只下載照片
mtp-transfer transfer ~/Pictures/Phone-Backup --filter "*.jpg"

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
- 穩定下載 2000+ 檔案
- 支援斷點續傳
- 清晰的進度回饋
- 可匯出下載記錄

## 實機測試結果

### ✅ 已測試裝置
- **Google Pixel 7a** - 成功連接並偵測
  - 需要手機設定為「檔案傳輸」模式
  - 首次連接可能需要調整 USB 設定

### 使用體驗回饋
1. **連接穩定性**：熱插拔部分支援，需手動重新偵測
2. **掃描速度**：大資料夾（如 /Pictures）可能需要等待
3. **進度顯示**：使用 `-r` 參數可顯示掃描進度條
4. **錯誤處理**：清楚的中文錯誤提示，方便排除問題

### 實際使用範例
```bash
# 偵測裝置
pnpm --filter @mtp-transfer/cli dev detect

# 列出手機照片（顯示進度）
pnpm --filter @mtp-transfer/cli dev list /DCIM -r

# 下載照片到電腦
pnpm --filter @mtp-transfer/cli dev transfer ~/Pictures/Pixel7a-Backup \
  --source /DCIM/Camera

# 查看下載進度
總進度: [████████████████░░░░] 85% | 127/150 檔案 | 2.3 MB/s | ETA: 2分15秒
```
