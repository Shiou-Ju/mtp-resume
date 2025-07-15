/**
 * SQLite database module for MTP transfer state management
 */

import Database from 'better-sqlite3';
import { 
  TransferRecord, 
  NewTransferRecord, 
  UpdateTransferRecord,
  DatabaseOptions,
  TransferStats,
  DatabaseInfo,
  TransferStatus
} from './types/database-types';
import { 
  CREATE_TRANSFERS_TABLE, 
  CREATE_TRANSFERS_INDEXES, 
  UPDATE_TIMESTAMP_TRIGGER 
} from './utils/schema';

export class TransferDatabase {
  private db: Database.Database;
  private filename: string;
  private isReadonly: boolean;

  constructor(filename: string = 'transfers.db', options: DatabaseOptions = {}) {
    this.filename = filename;
    this.isReadonly = options.readonly || false;
    
    this.db = new Database(filename, {
      readonly: this.isReadonly,
      verbose: options.verbose ? console.log : undefined
    });

    if (!this.isReadonly) {
      this.initializeDatabase();
    }
  }

  /**
   * Initialize database schema and indexes
   */
  private initializeDatabase(): void {
    // Create tables
    this.db.exec(CREATE_TRANSFERS_TABLE);
    
    // Create indexes
    CREATE_TRANSFERS_INDEXES.forEach(indexSql => {
      this.db.exec(indexSql);
    });
    
    // Create triggers
    this.db.exec(UPDATE_TIMESTAMP_TRIGGER);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * Add a new transfer record
   */
  addTransfer(record: NewTransferRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO transfers (file_path, file_size, status)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(
      record.file_path,
      record.file_size,
      record.status || 'pending'
    );
    
    return result.lastInsertRowid as number;
  }

  /**
   * Update transfer record status
   */
  updateTransfer(id: number, updates: UpdateTransferRecord): boolean {
    const setParts: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      setParts.push('status = ?');
      values.push(updates.status);
    }

    if (updates.error !== undefined) {
      setParts.push('error = ?');
      values.push(updates.error);
    }

    if (setParts.length === 0) {
      return false;
    }

    values.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE transfers 
      SET ${setParts.join(', ')}
      WHERE id = ?
    `);
    
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  /**
   * Get transfer record by ID
   */
  getTransfer(id: number): TransferRecord | null {
    const stmt = this.db.prepare('SELECT * FROM transfers WHERE id = ?');
    return stmt.get(id) as TransferRecord | null;
  }

  /**
   * Get transfer record by file path and size
   */
  getTransferByFile(filePath: string, fileSize: number): TransferRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM transfers 
      WHERE file_path = ? AND file_size = ?
    `);
    return stmt.get(filePath, fileSize) as TransferRecord | null;
  }

  /**
   * Get all transfers with optional status filter
   */
  getTransfers(status?: TransferStatus): TransferRecord[] {
    let query = 'SELECT * FROM transfers';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as TransferRecord[];
  }

  /**
   * Delete transfer record
   */
  deleteTransfer(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM transfers WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Get transfer statistics
   */
  getStats(): TransferStats {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'transferring' THEN 1 ELSE 0 END) as transferring,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
      FROM transfers
    `);
    
    return stmt.get() as TransferStats;
  }

  /**
   * Export transfers to CSV format
   */
  exportToCSV(): string {
    const transfers = this.getTransfers();
    
    const headers = ['id', 'file_path', 'file_size', 'status', 'error', 'created_at', 'updated_at'];
    const csvRows = [headers.join(',')];
    
    transfers.forEach(transfer => {
      const row = headers.map(header => {
        const value = transfer[header as keyof TransferRecord];
        // Escape quotes and wrap in quotes if contains comma
        const stringValue = String(value || '');
        return stringValue.includes(',') || stringValue.includes('"') 
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      });
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }

  /**
   * Get database information
   */
  getInfo(): DatabaseInfo {
    const stats = this.getStats();
    
    return {
      filename: this.filename,
      readonly: this.isReadonly,
      recordCount: stats.total,
      lastUpdated: this.getLastUpdatedTime()
    };
  }

  /**
   * Get last updated timestamp
   */
  private getLastUpdatedTime(): string | undefined {
    const stmt = this.db.prepare(`
      SELECT MAX(updated_at) as last_updated FROM transfers
    `);
    const result = stmt.get() as { last_updated: string | null };
    return result.last_updated || undefined;
  }

  /**
   * Clear all transfer records
   */
  clearAll(): number {
    const stmt = this.db.prepare('DELETE FROM transfers');
    const result = stmt.run();
    return result.changes;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Check if file already exists in database
   */
  fileExists(filePath: string, fileSize: number): boolean {
    const transfer = this.getTransferByFile(filePath, fileSize);
    return transfer !== null;
  }

  /**
   * Mark file as completed
   */
  markCompleted(id: number): boolean {
    return this.updateTransfer(id, { status: 'completed' });
  }

  /**
   * Mark file as failed with error message
   */
  markFailed(id: number, error: string): boolean {
    return this.updateTransfer(id, { status: 'failed', error });
  }

  /**
   * Mark file as transferring
   */
  markTransferring(id: number): boolean {
    return this.updateTransfer(id, { status: 'transferring' });
  }
}

// Export types for external use
export type { 
  TransferRecord, 
  NewTransferRecord, 
  UpdateTransferRecord,
  DatabaseOptions,
  TransferStats,
  DatabaseInfo,
  TransferStatus
};