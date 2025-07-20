import { CLIRunner } from '../utils/cli-runner'

async function test() {
  const cli = new CLIRunner()
  
  console.log('Testing NO_DEVICE scenario...')
  const result = await cli.run(['detect'], {
    env: { 
      MTP_MOCK_MODE: 'true',
      MTP_MOCK_NO_DEVICE: 'true'
    }
  })
  
  console.log('Exit code:', result.exitCode)
  console.log('Stdout:', result.stdout)
  console.log('Stderr:', result.stderr)
}

test()