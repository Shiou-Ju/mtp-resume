/**
 * @fileoverview Database Mock Implementation
 * @description Mock implementation of TransferDatabase for testing
 */

import { 
  TransferRecord, 
  TransferStatus, 
  NewTransferRecord,
  UpdateTransferRecord,
  DatabaseOptions,
  TransferStats,
  DatabaseInfo
} from '../../src/types/database-types'

export class MockTransferDatabase {
  private transfers: Map<number, TransferRecord> = new Map()
  private nextId: number = 1
  private isOpen: boolean = true
  private filename: string
  private isReadonly: boolean
  
  constructor(filename: string = 'transfers.db', options: DatabaseOptions = {}) {
    this.filename = filename
    this.isReadonly = options.readonly || false
  }

  /**
   * Initialize database tables (mock)
   */
  init(): void {
    this.isOpen = true
  }

  /**
   * Add a new transfer record
   */
  addTransfer(record: NewTransferRecord): number {
    this.checkOpen()
    
    const now = new Date().toISOString()
    const transfer: TransferRecord = {
      id: this.nextId++,
      file_path: record.file_path,
      file_size: record.file_size,
      status: record.status || 'pending',
      created_at: now,
      updated_at: now
    }
    
    this.transfers.set(transfer.id, transfer)
    return transfer.id
  }

  /**
   * Update transfer record
   */
  updateTransfer(id: number, updates: UpdateTransferRecord): boolean {
    this.checkOpen()
    
    const transfer = this.transfers.get(id)
    if (!transfer) {
      return false
    }
    
    if (updates.status !== undefined) {
      transfer.status = updates.status
    }
    if (updates.error !== undefined) {
      transfer.error = updates.error
    }
    
    transfer.updated_at = new Date().toISOString()
    
    return true
  }

  /**
   * Get a single transfer by ID
   */
  getTransfer(id: number): TransferRecord | null {
    this.checkOpen()
    
    const transfer = this.transfers.get(id)
    return transfer ? { ...transfer } : null
  }

  /**
   * Get transfer by file path and size
   */
  getTransferByFile(filePath: string, fileSize: number): TransferRecord | null {
    this.checkOpen()
    
    for (const transfer of this.transfers.values()) {
      if (transfer.file_path === filePath && transfer.file_size === fileSize) {
        return { ...transfer }
      }
    }
    
    return null
  }

  /**
   * Get transfers with optional status filter
   */
  getTransfers(status?: TransferStatus): TransferRecord[] {
    this.checkOpen()
    
    let results = Array.from(this.transfers.values())
    
    if (status) {
      results = results.filter(t => t.status === status)
    }
    
    // Sort by created_at desc
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    return results.map(t => ({ ...t }))
  }

  /**
   * Delete a transfer record
   */
  deleteTransfer(id: number): boolean {
    this.checkOpen()
    return this.transfers.delete(id)
  }

  /**
   * Clear all transfers
   */
  clearAllTransfers(): number {
    this.checkOpen()
    const count = this.transfers.size
    this.transfers.clear()
    return count
  }

  /**
   * Get or create transfer (for resume functionality)
   */
  getOrCreateTransfer(filePath: string, fileSize: number): TransferRecord {
    this.checkOpen()
    
    const existing = this.getTransferByFile(filePath, fileSize)
    if (existing && existing.status !== 'completed') {
      return existing
    }
    
    const id = this.addTransfer({
      file_path: filePath,
      file_size: fileSize,
      status: 'pending'
    })
    
    return this.getTransfer(id)!
  }

  /**
   * Get transfer statistics
   */
  getStatistics(): TransferStats {
    this.checkOpen()
    
    const stats: TransferStats = {
      total: 0,
      pending: 0,
      transferring: 0,
      completed: 0,
      failed: 0,
      skipped: 0
    }
    
    for (const transfer of this.transfers.values()) {
      stats.total++
      stats[transfer.status]++
    }
    
    return stats
  }

  /**
   * Export transfers as CSV
   */
  exportAsCSV(): string {
    this.checkOpen()
    
    const transfers = this.getTransfers()
    const headers = ['id', 'file_path', 'file_size', 'status', 'error', 'created_at', 'updated_at']
    const rows = transfers.map(t => [
      t.id,
      t.file_path,
      t.file_size,
      t.status,
      t.error || '',
      t.created_at,
      t.updated_at
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  /**
   * Get database info
   */
  getDatabaseInfo(): DatabaseInfo {
    this.checkOpen()
    
    const transfers = Array.from(this.transfers.values())
    const lastUpdated = transfers.length > 0 
      ? transfers.reduce((latest, t) => t.updated_at > latest ? t.updated_at : latest, transfers[0].updated_at)
      : undefined
    
    return {
      filename: this.filename,
      readonly: this.isReadonly,
      recordCount: this.transfers.size,
      lastUpdated
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.isOpen = false
  }
  
  /**
   * Check if database is open
   */
  private checkOpen(): void {
    if (!this.isOpen) {
      throw new Error('Database is closed')
    }
  }

  /**
   * Reset mock data (useful for tests)
   */
  reset(): void {
    this.transfers.clear()
    this.nextId = 1
    this.isOpen = true
  }
}

// Also need to provide type exports to match the real module
export type { 
  TransferRecord, 
  NewTransferRecord, 
  UpdateTransferRecord,
  DatabaseOptions,
  TransferStats,
  DatabaseInfo
}

// Export as default to match the real implementation
export default MockTransferDatabase