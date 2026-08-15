import assert from 'node:assert/strict'
import test from 'node:test'

async function loadDefinition() {
  let plugin
  globalThis.document = {
    head: { appendChild() {} },
    querySelector() { return {} },
    createElement() { return { dataset: {} } },
  }
  globalThis.window = { __ModuleLoader__: { load(entry) { plugin = entry.factory(id => id === 'react' ? { createElement() {} } : {}) } } }
  await import(`../lib/client.js?test=${Date.now()}`)
  let definition
  plugin.apply({
    conversationEvents: { register(value) { definition = value } },
    slots: { inject() {} },
  })
  return definition
}

const location = { kind: 'step', turn: 1, step: 1 }

test('Renoise generation projection replays running and completed states', async () => {
  const definition = await loadDefinition()
  const call = { type: 'tool/call', seq: 4, time: 1, data: { turn: 1, step: 1, callId: 'call-1', name: 'renoise_generate_video', arguments: JSON.stringify({ model: 'seedance', duration: 5, ratio: '16:9', estimatedCredits: 10 }) } }
  const result = { type: 'tool/result', seq: 5, time: 2, data: { turn: 1, step: 1, message: { toolCallId: 'call-1' }, meta: { taskId: 'task-1', result: { url: 'https://cdn.example/video.mp4' } } } }
  assert.deepEqual(definition.match(call), { id: 'call-1', role: 'start' })
  let state = definition.start({}, { event: call, location })
  const context = { id: 'call-1', key: 'renoise/generation:call-1', state, start: { event: call, location }, matches: [] }
  assert.equal(definition.buildViewNode(context).data.status, 'running')
  state = definition.update(context, { event: result, location })
  const completed = definition.buildViewNode({ ...context, state })
  assert.equal(completed.key, context.key)
  assert.equal(completed.data.status, 'completed')
  assert.equal(completed.data.videoUrl, 'https://cdn.example/video.mp4')
})
