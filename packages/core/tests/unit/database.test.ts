/**
 * @fileoverview Database Module Unit Tests
 * @description Tests for TransferDatabase functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TransferDatabase } from '../../src/database'
import type { NewTransferRecord, UpdateTransferRecord } from '../../src/database'
import fs from 'fs'
import path from 'path'

describe('TransferDatabase', () => {
  let db: TransferDatabase
  const testDbPath = path.join(__dirname, '../test-transfer.db')

  beforeEach(() => {
    // Ensure test database is clean
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    db = new TransferDatabase(testDbPath)
  })

  afterEach(() => {
    // Clean up
    if (db) {
      db.close()
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  describe('Database Initialization', () => {
    it('should create database file', () => {
      expect(fs.existsSync(testDbPath)).toBe(true)
    })

    it('should create transfers table', () => {
      const tableInfo = db['db']
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transfers'")
        .get()
      expect(tableInfo).toBeDefined()
    })

    it('should have correct schema', () => {
      const columns = db['db'].prepare('PRAGMA table_info(transfers)').all()
      const columnNames = columns.map((col: any) => col.name)
      
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('file_path')
      expect(columnNames).toContain('file_size')
      expect(columnNames).toContain('status')
      expect(columnNames).toContain('created_at')
      expect(columnNames).toContain('updated_at')
      expect(columnNames).toContain('error')
    })
  })

  describe('CRUD Operations', () => {
    describe('createTransfer', () => {
      it('should create a new transfer record', () => {
        const newTransfer: NewTransferRecord = {
          file_path: '/test/file.txt',
          file_size: 1024,
          status: 'pending'
        }

        const id = db.createTransfer(newTransfer)
        expect(id).toBeGreaterThan(0)

        const record = db.getTransfer(id)
        expect(record).toBeDefined()
        expect(record?.file_path).toBe('/test/file.txt')
        expect(record?.file_size).toBe(1024)
        expect(record?.status).toBe('pending')
      })

      it('should set timestamps automatically', () => {
        const newTransfer: NewTransferRecord = {
          file_path: '/test/file.txt',
          file_size: 1024,
          status: 'pending'
        }

        const id = db.createTransfer(newTransfer)
        const record = db.getTransfer(id)

        expect(record?.created_at).toBeDefined()
        expect(record?.updated_at).toBeDefined()
        expect(new Date(record!.created_at).getTime()).toBeLessThanOrEqual(Date.now())
      })
    })

    describe('updateTransfer', () => {
      it('should update transfer status', () => {
        const id = db.createTransfer({
          file_path: '/test/file.txt',
          file_size: 1024,
          status: 'pending'
        })

        const update: UpdateTransferRecord = {
          status: 'completed'
        }

        const success = db.updateTransfer(id, update)
        expect(success).toBe(true)

        const record = db.getTransfer(id)
        expect(record?.status).toBe('completed')
      })

      it('should update error message', () => {
        const id = db.createTransfer({
          file_path: '/test/file.txt',
          file_size: 1024,
          status: 'pending'
        })

        const update: UpdateTransferRecord = {
          status: 'failed',
          error: 'Connection timeout'
        }

        db.updateTransfer(id, update)
        const record = db.getTransfer(id)
        
        expect(record?.status).toBe('failed')
        expect(record?.error).toBe('Connection timeout')
      })

      it('should update timestamp on modification', async () => {
        const id = db.createTransfer({
          file_path: '/test/file.txt',
          file_size: 1024,
          status: 'pending'
        })

        const originalRecord = db.getTransfer(id)
        const originalTime = originalRecord!.updated_at

        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10))

        db.updateTransfer(id, { status: 'completed' })
        const updatedRecord = db.getTransfer(id)

        expect(updatedRecord!.updated_at).not.toBe(originalTime)
        expect(new Date(updatedRecord!.updated_at).getTime())
          .toBeGreaterThan(new Date(originalTime).getTime())
      })
    })

    describe('getTransfers', () => {
      beforeEach(() => {
        // Create test data
        db.createTransfer({ file_path: '/file1.txt', file_size: 100, status: 'completed' })
        db.createTransfer({ file_path: '/file2.txt', file_size: 200, status: 'failed' })
        db.createTransfer({ file_path: '/file3.txt', file_size: 300, status: 'pending' })
        db.createTransfer({ file_path: '/file4.txt', file_size: 400, status: 'completed' })
      })

      it('should get all transfers', () => {
        const transfers = db.getTransfers()
        expect(transfers).toHaveLength(4)
      })

      it('should filter by status', () => {
        const completed = db.getTransfers('completed')
        expect(completed).toHaveLength(2)
        expect(completed.every(t => t.status === 'completed')).toBe(true)

        const failed = db.getTransfers('failed')
        expect(failed).toHaveLength(1)
        expect(failed[0].file_path).toBe('/file2.txt')

        const pending = db.getTransfers('pending')
        expect(pending).toHaveLength(1)
        expect(pending[0].file_path).toBe('/file3.txt')
      })

      it('should return ordered by created_at desc', () => {
        const transfers = db.getTransfers()
        for (let i = 0; i < transfers.length - 1; i++) {
          const current = new Date(transfers[i].created_at).getTime()
          const next = new Date(transfers[i + 1].created_at).getTime()
          expect(current).toBeGreaterThanOrEqual(next)
        }
      })
    })
  })

  describe('Special Operations', () => {
    describe('getOrCreateTransfer', () => {
      it('should create new transfer if not exists', () => {
        const transfer = db.getOrCreateTransfer('/new/file.txt', 500)
        expect(transfer.id).toBeDefined()
        expect(transfer.file_path).toBe('/new/file.txt')
        expect(transfer.file_size).toBe(500)
        expect(transfer.status).toBe('pending')
      })

      it('should return existing transfer with same path and size', () => {
        const first = db.getOrCreateTransfer('/test/file.txt', 1000)
        const second = db.getOrCreateTransfer('/test/file.txt', 1000)
        
        expect(second.id).toBe(first.id)
        expect(db.getTransfers()).toHaveLength(1)
      })

      it('should create new transfer if size differs', () => {
        const first = db.getOrCreateTransfer('/test/file.txt', 1000)
        const second = db.getOrCreateTransfer('/test/file.txt', 2000)
        
        expect(second.id).not.toBe(first.id)
        expect(db.getTransfers()).toHaveLength(2)
      })
    })

    describe('deleteTransfer', () => {
      it('should delete transfer record', () => {
        const id = db.createTransfer({
          file_path: '/test/file.txt',
          file_size: 1024,
          status: 'pending'
        })

        const success = db.deleteTransfer(id)
        expect(success).toBe(true)

        const record = db.getTransfer(id)
        expect(record).toBeUndefined()
      })

      it('should return false for non-existent record', () => {
        const success = db.deleteTransfer(999)
        expect(success).toBe(false)
      })
    })

    describe('clearAllTransfers', () => {
      it('should delete all transfer records', () => {
        // Create test data
        db.createTransfer({ file_path: '/file1.txt', file_size: 100, status: 'completed' })
        db.createTransfer({ file_path: '/file2.txt', file_size: 200, status: 'failed' })
        db.createTransfer({ file_path: '/file3.txt', file_size: 300, status: 'pending' })

        expect(db.getTransfers()).toHaveLength(3)

        const deleted = db.clearAllTransfers()
        expect(deleted).toBe(3)
        expect(db.getTransfers()).toHaveLength(0)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid database path gracefully', () => {
      expect(() => {
        new TransferDatabase('/invalid/path/to/database.db')
      }).toThrow()
    })

    it('should handle closed database operations', () => {
      db.close()
      
      expect(() => {
        db.createTransfer({
          file_path: '/test/file.txt',
          file_size: 1024,
          status: 'pending'
        })
      }).toThrow()
    })
  })

  describe('Database Info', () => {
    it('should return database info', () => {
      const info = db.getDatabaseInfo()
      
      expect(info.path).toBe(testDbPath)
      expect(info.version).toBeDefined()
      expect(info.totalRecords).toBe(0)
      expect(info.size).toBeGreaterThan(0)
    })

    it('should update record count in info', () => {
      db.createTransfer({ file_path: '/file1.txt', file_size: 100, status: 'pending' })
      db.createTransfer({ file_path: '/file2.txt', file_size: 200, status: 'pending' })
      
      const info = db.getDatabaseInfo()
      expect(info.totalRecords).toBe(2)
    })
  })
})