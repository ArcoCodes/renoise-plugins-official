import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apply as registerSkills } from '@deepseek-ai/dsh-skill-filesystem'

const root = dirname(fileURLToPath(import.meta.url))

export const name = 'renoise-dsh'
export const inject = ['skills', 'tools', 'approval', 'shell']

export function apply(ctx) {
  registerSkills(ctx, {
    providerName: 'renoise',
    includeDefaultRoots: false,
    customSkillDirs: [join(root, 'skills')],
  })

  ctx.tools.register({
    name: 'renoise_generate_video',
    description: 'Create one approved Renoise video task after quoting its live CLI credit estimate. Use only after renoise task cost and account status have supplied the exact estimate and balance.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['model', 'prompt', 'duration', 'ratio', 'resolution', 'audioGeneration', 'estimatedCredits', 'availableCredits'],
      properties: {
        model: { type: 'string', minLength: 1 },
        prompt: { type: 'string', minLength: 1 },
        duration: { type: 'number', exclusiveMinimum: 0 },
        ratio: { type: 'string', minLength: 1 },
        resolution: { type: 'string', minLength: 1 },
        audioGeneration: { type: 'boolean' },
        estimatedCredits: { type: 'number', minimum: 0 },
        availableCredits: { type: 'number', minimum: 0 },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, required: ['taskId', 'result'], properties: { taskId: { type: 'string' }, result: { type: 'object' } } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      presentationMeta: (_args, value) => value,
    },
    presentCall: args => ({ kind: 'card', title: `Renoise video · ${args.model}` }),
    presentResult: (_args, result) => ({ kind: 'card', title: result.isError ? 'Renoise generation failed' : 'Renoise video ready' }),
    async execute(args, exec) {
      if (!exec.agent) throw new Error('renoise generation requires an agent session')
      const outcome = await ctx.approval.request({
        agent: exec.agent,
        toolName: 'renoise_generate_video',
        callId: exec.callId,
        reason: `Generate one ${args.duration}s ${args.ratio} video with ${args.model} for an estimated ${args.estimatedCredits} credits (${args.availableCredits} available).`,
        signal: exec.signal,
      })
      if (outcome !== 'allowed-once') throw new Error(`Renoise generation ${outcome}`)
      const result = await ctx.shell.run(ctx.shell.resolve({
        command: `node ${JSON.stringify(join(root, 'scripts/dsh-generate.mjs'))}`,
        stdin: JSON.stringify(args),
        signal: exec.signal,
        timeoutMs: 16 * 60_000,
        stdoutMaxBytes: 2_000_000,
      }))
      if (result.exitCode !== 0) throw new Error(result.stderr.text || `Renoise generation exited with code ${result.exitCode}`)
      return JSON.parse(result.stdout.text)
    },
  })
}
