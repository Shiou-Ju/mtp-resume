/**
 * @fileoverview Test Setup Configuration
 * @description Global test setup for core package
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// Test database path
export const TEST_DB_PATH = path.join(__dirname, 'test.db')

// Clean up test artifacts
beforeAll(() => {
  // Ensure test directory exists
  const testDir = path.dirname(TEST_DB_PATH)
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
})

afterAll(() => {
  // Clean up test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH)
  }
})

// Reset test state between tests
beforeEach(() => {
  // Can add more setup here
})

afterEach(() => {
  // Clean up after each test
})