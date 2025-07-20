import { CLIRunner } from '../utils/cli-runner'

async function test() {
  const cli = new CLIRunner()
  
  console.log('Testing status command...')
  const result = await cli.runMocked(['status'])
  
  console.log('Exit code:', result.exitCode)
  console.log('Stdout:', result.stdout)
  console.log('Stderr:', result.stderr)
}

test()