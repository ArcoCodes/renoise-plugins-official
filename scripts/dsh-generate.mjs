import { spawn } from 'node:child_process'

const input = JSON.parse(await new Promise((resolve) => {
  let value = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => { value += chunk })
  process.stdin.on('end', () => resolve(value))
}))

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('renoise', args, { stdio: ['ignore', 'pipe', 'inherit'] })
    let stdout = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(`renoise exited with code ${code}`)))
  })
}

const create = await run([
  'task', 'create', input.model,
  '--prompt', input.prompt,
  '--type', 'video',
  '--duration', String(input.duration),
  '--ratio', input.ratio,
  '--resolution', input.resolution,
  `--audio-generation=${input.audioGeneration}`,
  '--json',
])
const taskId = create.task?.id ?? create.id
if (!taskId) throw new Error('renoise task create returned no task id')
const result = await run(['task', 'wait', String(taskId), '--timeout', '15m', '--json'])
process.stdout.write(JSON.stringify({ taskId: String(taskId), result }))
