import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apply as registerSkills } from '@deepseek-ai/dsh-skill-filesystem'

export const name = 'renoise-dsh'
export const inject = ['skills']

export function apply(ctx) {
  registerSkills(ctx, {
    providerName: 'renoise',
    includeDefaultRoots: false,
    customSkillDirs: [join(dirname(fileURLToPath(import.meta.url)), 'skills')],
  })
}
