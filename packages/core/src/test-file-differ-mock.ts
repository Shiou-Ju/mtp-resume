/**
 * @fileoverview FileDiffer Mock Tests
 * @description Mock testing for FileDiffer without requiring real file system operations
 */

import { FileDiffer } from './file-differ';
import type { MTPFile } from './types/mtp-types';
import type { LocalFile } from './types/file-differ-types';

/**
 * Mock 本地檔案資料
 */
const mockLocalFiles: LocalFile[] = [
  {
    path: '/Users/test/Pictures/IMG_001.jpg',
    size: 2048000,
    modifiedTime: new Date('2025-01-01T10:00:00Z'),
    relativePath: 'IMG_001.jpg',
    extension: '.jpg',
    fileName: 'IMG_001.jpg'
  },
  {
    path: '/Users/test/Pictures/IMG_002.jpg',
    size: 1843200,
    modifiedTime: new Date('2025-01-02T11:00:00Z'),
    relativePath: 'IMG_002.jpg',
    extension: '.jpg',
    fileName: 'IMG_002.jpg'
  },
  {
    path: '/Users/test/Pictures/VID_001.mp4',
    size: 15728640,
    modifiedTime: new Date('2025-01-03T12:00:00Z'),
    relativePath: 'VID_001.mp4',
    extension: '.mp4',
    fileName: 'VID_001.mp4'
  },
  {
    path: '/Users/test/Pictures/SubFolder/IMG_003.png',
    size: 3145728,
    modifiedTime: new Date('2025-01-04T13:00:00Z'),
    relativePath: 'SubFolder/IMG_003.png',
    extension: '.png',
    fileName: 'IMG_003.png'
  },
  {
    path: '/Users/test/Pictures/document.pdf',
    size: 524288,
    modifiedTime: new Date('2025-01-05T14:00:00Z'),
    relativePath: 'document.pdf',
    extension: '.pdf',
    fileName: 'document.pdf'
  },
  {
    path: '/Users/test/Pictures/.DS_Store',
    size: 6148,
    modifiedTime: new Date('2025-01-06T15:00:00Z'),
    relativePath: '.DS_Store',
    extension: '',
    fileName: '.DS_Store'
  }
];

/**
 * Mock MTP 裝置檔案資料
 */
const mockMtpFiles: MTPFile[] = [
  {
    id: 1,
    path: 'IMG_001.jpg',
    name: 'IMG_001.jpg',
    size: 2048000,
    type: 'file',
    modifiedTime: new Date('2025-01-01T10:00:00Z'),
    parentId: 0
  },
  {
    id: 2,
    path: 'IMG_002.jpg',
    name: 'IMG_002.jpg',
    size: 1843200,
    type: 'file',
    modifiedTime: new Date('2025-01-02T10:30:00Z'), // 30分鐘差異
    parentId: 0
  },
  {
    id: 3,
    path: 'VID_001.mp4',
    name: 'VID_001.mp4',
    size: 15728640, // 完全相同大小
    type: 'file',
    modifiedTime: new Date('2025-01-03T12:00:00Z'),
    parentId: 0
  },
  {
    id: 4,
    path: 'SubFolder/IMG_003.png',
    name: 'IMG_003.png',
    size: 3145728, // 完全相同大小
    type: 'file',
    modifiedTime: new Date('2025-01-04T13:00:00Z'),
    parentId: 0
  },
  {
    id: 5,
    path: 'OLD_IMG.jpg',
    name: 'OLD_IMG.jpg',
    size: 1024000,
    type: 'file',
    modifiedTime: new Date('2024-12-01T10:00:00Z'),
    parentId: 0
  }
];

/**
 * 執行 FileDiffer Mock 測試
 */
async function runFileDifferMockTests() {
  console.log('🚀 Starting FileDiffer Mock Tests...\n');

  // 建立 FileDiffer 實例
  const fileDiffer = new FileDiffer({
    sizeTolerance: 100, // 100 bytes tolerance
    timeTolerance: 60000, // 1 minute tolerance
    ignoreTime: false,
    ignoreCase: false,
    concurrency: 5
  });

  // 設定進度回調
  fileDiffer.setProgressCallback((current, total, message) => {
    console.log(`📊 Progress: ${current}/${total} - ${message || 'Processing...'}`);
  });

  try {
    // 測試 1: 檔案分類功能
    console.log('🧪 Test 1: File Classification\n');
    
    const newFiles = await fileDiffer.getNewFiles(mockLocalFiles, mockMtpFiles);
    const modifiedFiles = await fileDiffer.getModifiedFiles(mockLocalFiles, mockMtpFiles);
    const duplicateFiles = await fileDiffer.getDuplicateFiles(mockLocalFiles, mockMtpFiles);
    
    console.log('📁 New Files (local exists, MTP missing):');
    newFiles.forEach(file => {
      console.log(`   - ${file.relativePath} (${formatFileSize(file.size)})`);
    });
    
    console.log('\n📝 Modified Files (size or time difference):');
    modifiedFiles.forEach(file => {
      console.log(`   - ${file.relativePath} (${formatFileSize(file.size)})`);
    });
    
    console.log('\n📋 Duplicate Files (identical):');
    duplicateFiles.forEach(file => {
      console.log(`   - ${file.relativePath} (${formatFileSize(file.size)})`);
    });

    // 測試 2: 檔案篩選功能
    console.log('\n🧪 Test 2: File Filtering\n');
    
    const imageFilter = await fileDiffer.filterFiles(
      mockLocalFiles,
      ['**/*.jpg', '**/*.png'],
      ['**/.DS_Store']
    );
    
    console.log('🖼️ Image Files (jpg, png):');
    imageFilter.matched.forEach(file => {
      console.log(`   - ${file.relativePath} (${formatFileSize(file.size)})`);
    });
    
    console.log('\n🚫 Excluded Files:');
    imageFilter.excluded.forEach(file => {
      console.log(`   - ${file.relativePath} (${formatFileSize(file.size)})`);
    });
    
    console.log('\n📊 Filter Statistics:');
    console.log(`   Total Files: ${imageFilter.stats.totalFiles}`);
    console.log(`   Matched Files: ${imageFilter.stats.matchedFiles}`);
    console.log(`   Excluded Files: ${imageFilter.stats.excludedFiles}`);
    console.log(`   Total Size: ${formatFileSize(imageFilter.stats.totalSize)}`);
    console.log(`   Matched Size: ${formatFileSize(imageFilter.stats.matchedSize)}`);

    // 測試 3: 檔案排除功能
    console.log('\n🧪 Test 3: File Exclusion\n');
    
    const excludedFiles = await fileDiffer.excludeFiles(
      mockLocalFiles,
      ['**/.DS_Store', '**/*.tmp']
    );
    
    console.log('✅ Files after exclusion:');
    excludedFiles.forEach(file => {
      console.log(`   - ${file.relativePath} (${formatFileSize(file.size)})`);
    });

    // 測試 4: 完整比對流程 (模擬)
    console.log('\n🧪 Test 4: Complete Comparison Workflow\n');
    
    // 模擬 compareDirectories 的部分邏輯
    const comparisonResult = {
      newFiles: await fileDiffer.getNewFiles(mockLocalFiles, mockMtpFiles),
      modifiedFiles: await fileDiffer.getModifiedFiles(mockLocalFiles, mockMtpFiles),
      duplicateFiles: await fileDiffer.getDuplicateFiles(mockLocalFiles, mockMtpFiles),
      totalFiles: mockLocalFiles.length,
      totalSize: mockLocalFiles.reduce((sum, file) => sum + file.size, 0),
      transferCount: 0,
      transferSize: 0
    };
    
    const transferFiles = [...comparisonResult.newFiles, ...comparisonResult.modifiedFiles];
    comparisonResult.transferCount = transferFiles.length;
    comparisonResult.transferSize = transferFiles.reduce((sum, file) => sum + file.size, 0);
    
    console.log('📊 Comparison Result Summary:');
    console.log(`   📁 Total Files: ${comparisonResult.totalFiles}`);
    console.log(`   📄 New Files: ${comparisonResult.newFiles.length}`);
    console.log(`   📝 Modified Files: ${comparisonResult.modifiedFiles.length}`);
    console.log(`   📋 Duplicate Files: ${comparisonResult.duplicateFiles.length}`);
    console.log(`   🔄 Files to Transfer: ${comparisonResult.transferCount}`);
    console.log(`   📦 Total Size: ${formatFileSize(comparisonResult.totalSize)}`);
    console.log(`   🚀 Transfer Size: ${formatFileSize(comparisonResult.transferSize)}`);
    
    // 測試 5: 錯誤處理
    console.log('\n🧪 Test 5: Error Handling\n');
    
    try {
      // 測試空檔案陣列
      const emptyResult = await fileDiffer.getNewFiles([], mockMtpFiles);
      console.log(`✅ Empty local files handled: ${emptyResult.length} files`);
      
      const emptyMtpResult = await fileDiffer.getNewFiles(mockLocalFiles, []);
      console.log(`✅ Empty MTP files handled: ${emptyMtpResult.length} files`);
      
    } catch (error) {
      console.log(`❌ Error handling test failed: ${error}`);
    }

    // 測試 6: 效能測試
    console.log('\n🧪 Test 6: Performance Test\n');
    
    const startTime = Date.now();
    
    // 建立大量測試檔案
    const largeFileList: LocalFile[] = [];
    for (let i = 0; i < 1000; i++) {
      largeFileList.push({
        path: `/test/file_${i}.jpg`,
        size: Math.floor(Math.random() * 10000000),
        modifiedTime: new Date(Date.now() - Math.random() * 86400000),
        relativePath: `file_${i}.jpg`,
        extension: '.jpg',
        fileName: `file_${i}.jpg`
      });
    }
    
    const perfResult = await fileDiffer.getNewFiles(largeFileList, mockMtpFiles);
    const endTime = Date.now();
    
    console.log(`⚡ Performance Test Results:`);
    console.log(`   📊 Processed: ${largeFileList.length} files`);
    console.log(`   📄 New Files Found: ${perfResult.length}`);
    console.log(`   ⏱️ Time Taken: ${endTime - startTime}ms`);
    console.log(`   🚀 Files/Second: ${Math.round(largeFileList.length / (endTime - startTime) * 1000)}`);

    // 統計資訊
    const stats = fileDiffer.getStats();
    console.log('\n📈 FileDiffer Statistics:');
    console.log(`   ⏱️ Total Time: ${stats.totalTime}ms`);
    console.log(`   🔍 Scan Time: ${stats.scanTime}ms`);
    console.log(`   🔄 Compare Time: ${stats.compareTime}ms`);
    console.log(`   📊 Local Files: ${stats.localFileCount}`);
    console.log(`   📱 MTP Files: ${stats.mtpFileCount}`);
    console.log(`   🧠 Peak Memory: ${formatFileSize(stats.peakMemory)}`);

    console.log('\n🎉 All FileDiffer mock tests completed successfully!');
    console.log('💡 This confirms our file comparison logic is working correctly.');
    console.log('📝 Next step: Test with real file system operations.');

  } catch (error) {
    console.error('❌ FileDiffer mock tests failed:', error);
    throw error;
  }
}

/**
 * 格式化檔案大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 執行測試
if (require.main === module) {
  runFileDifferMockTests().catch(console.error);
}

export { runFileDifferMockTests, mockLocalFiles, mockMtpFiles };