/**
 * Database schema definitions for SQLite
 */

export const CREATE_TRANSFERS_TABLE = `
  CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_path, file_size)
  )
`;

export const CREATE_TRANSFERS_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_status ON transfers(status)',
  'CREATE INDEX IF NOT EXISTS idx_file_path ON transfers(file_path)',
  'CREATE INDEX IF NOT EXISTS idx_created_at ON transfers(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_updated_at ON transfers(updated_at)'
];

export const UPDATE_TIMESTAMP_TRIGGER = `
  CREATE TRIGGER IF NOT EXISTS update_transfers_timestamp 
  AFTER UPDATE ON transfers
  FOR EACH ROW
  BEGIN
    UPDATE transfers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END
`;