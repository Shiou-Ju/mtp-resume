/**
 * Simple test to debug the mock system
 */

import { CLIRunner } from '../utils/cli-runner'

async function testMock() {
  console.log('Environment:', {
    MTP_MOCK_MODE: process.env.MTP_MOCK_MODE,
    NODE_ENV: process.env.NODE_ENV
  })

  const cli = new CLIRunner()
  
  try {
    console.log('Running detect command with mock mode...')
    const result = await cli.runMocked(['detect'])
    console.log('Result:', result)
  } catch (error) {
    console.error('Error:', error)
  }
}

testMock()