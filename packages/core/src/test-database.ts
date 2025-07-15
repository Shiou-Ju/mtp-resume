/**
 * Simple functionality test for TransferDatabase
 * Run with: node dist/test-database.js
 */

import { TransferDatabase } from './database';

async function testDatabase() {
  console.log('🧪 Testing TransferDatabase functionality...\n');

  // Create test database
  const db = new TransferDatabase(':memory:', { verbose: false });
  
  try {
    // Test 1: Add transfers
    console.log('📝 Test 1: Adding transfer records');
    const id1 = db.addTransfer({
      file_path: '/test/file1.jpg',
      file_size: 1024000,
      status: 'pending'
    });
    
    const id2 = db.addTransfer({
      file_path: '/test/file2.mp4',
      file_size: 5242880
    });
    
    console.log(`   ✅ Added transfer 1: ID ${id1}`);
    console.log(`   ✅ Added transfer 2: ID ${id2}\n`);

    // Test 2: Get transfers
    console.log('📖 Test 2: Retrieving transfers');
    const transfer1 = db.getTransfer(id1);
    const transfer2 = db.getTransferByFile('/test/file2.mp4', 5242880);
    
    console.log(`   ✅ Retrieved by ID: ${transfer1?.file_path}`);
    console.log(`   ✅ Retrieved by file: ${transfer2?.file_path}\n`);

    // Test 3: Update status
    console.log('🔄 Test 3: Updating transfer status');
    db.markTransferring(id1);
    db.markCompleted(id2);
    
    const updated1 = db.getTransfer(id1);
    const updated2 = db.getTransfer(id2);
    
    console.log(`   ✅ Transfer 1 status: ${updated1?.status}`);
    console.log(`   ✅ Transfer 2 status: ${updated2?.status}\n`);

    // Test 4: Statistics
    console.log('📊 Test 4: Database statistics');
    const stats = db.getStats();
    console.log('   Statistics:', {
      total: stats.total,
      completed: stats.completed,
      transferring: stats.transferring,
      pending: stats.pending
    });
    console.log();

    // Test 5: List all transfers
    console.log('📋 Test 5: List all transfers');
    const allTransfers = db.getTransfers();
    allTransfers.forEach((transfer, index) => {
      console.log(`   ${index + 1}. ${transfer.file_path} [${transfer.status}]`);
    });
    console.log();

    // Test 6: Export CSV
    console.log('📤 Test 6: CSV Export (first 200 chars)');
    const csv = db.exportToCSV();
    console.log(`   ${csv.substring(0, 200)}...\n`);

    // Test 7: Database info
    console.log('ℹ️  Test 7: Database information');
    const info = db.getInfo();
    console.log('   Info:', {
      filename: info.filename,
      recordCount: info.recordCount,
      readonly: info.readonly
    });

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    db.close();
    console.log('🔒 Database closed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testDatabase();
}

export { testDatabase };