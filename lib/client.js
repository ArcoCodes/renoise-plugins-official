window.__ModuleLoader__.load({ id: '@renoise/plugin', factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
const React = require('react')

const css = `.renoise-card{width:100%;padding:8px 0;color:var(--dsw-alias-label-primary)}.renoise-card__shell{overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:24px;background:var(--dsw-alias-bg-base);padding:12px}.renoise-card__head{display:flex;align-items:center;justify-content:space-between;gap:12px}.renoise-card__title{font-size:16px;font-weight:600}.renoise-card__meta{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:12px}.renoise-card__media{display:block;width:100%;height:268px;margin-top:12px;border-radius:12px;background:#000;object-fit:contain}.renoise-card__actions{display:flex;gap:8px;margin-top:12px}.renoise-card__button{min-height:40px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:transparent;color:inherit;padding:0 12px;cursor:pointer}.renoise-card__button:hover{background:var(--dsw-alias-interactive-bg-hover)}@media(prefers-reduced-motion:reduce){.renoise-card__button{transition:none}}`
if (!document.querySelector('style[data-plugin-css="@renoise/plugin"]')) {
  const tag = document.createElement('style')
  tag.dataset.plugin = '@renoise/plugin'
  tag.dataset.pluginCss = '@renoise/plugin'
  tag.textContent = css
  document.head.appendChild(tag)
}

function parse(value) { try { return JSON.parse(value) } catch { return {} } }
function videoUrl(value) {
  if (typeof value === 'string' && /^https?:\/\/.*\.(mp4|webm|mov)(\?|$)/i.test(value)) return value
  if (!value || typeof value !== 'object') return undefined
  for (const item of Object.values(value)) { const found = videoUrl(item); if (found) return found }
}
function dataOf(state) { return { ...state.args, status: state.status, videoUrl: state.videoUrl, error: state.error } }

const definition = {
  kind: 'renoise/generation', target: 'chat',
  match(event) {
    if (event.type === 'tool/call' && event.data.name === 'renoise_generate_video') return { id: String(event.data.callId), role: 'start' }
    if (event.type === 'tool/result') return { id: String(event.data.message.toolCallId), role: 'update' }
    return null
  },
  start(_context, match) {
    if (match.event.type !== 'tool/call') throw new Error('renoise/generation requires tool/call')
    return { turn: match.event.data.turn, step: match.event.data.step, args: parse(match.event.data.arguments), status: 'running' }
  },
  update(context, match) {
    if (match.event.type !== 'tool/result') return context.state
    const payload = match.event.data.meta
    return { ...context.state, status: match.event.data.error ? 'failed' : 'completed', videoUrl: videoUrl(payload), error: match.event.data.error?.code }
  },
  publication: 'immediate',
  buildLocationData(context, scope) {
    if (scope !== 'step' || !context.state) return null
    return { kind: 'step', turn: context.state.turn, step: context.state.step, key: 'renoise/generation', value: dataOf(context.state) }
  },
  buildViewNode(context) {
    if (!context.state) return null
    return { key: context.key, kind: 'renoise/generation', id: context.id, target: 'chat', anchorSeq: context.start?.event.seq ?? context.matches[0]?.event.seq ?? 0, location: context.start?.location ?? { kind: 'unresolved' }, visibility: 'visible', data: dataOf(context.state) }
  },
}

function GenerationCard({ node }) {
  const d = node.data
  const title = d.status === 'completed' ? 'Video ready' : d.status === 'failed' ? 'Generation failed' : 'Generating video'
  const copy = text => navigator.clipboard.writeText(text)
  return React.createElement('section', { className: 'renoise-card', 'aria-label': title }, React.createElement('div', { className: 'renoise-card__shell' },
    React.createElement('div', { className: 'renoise-card__head' }, React.createElement('div', null,
      React.createElement('div', { className: 'renoise-card__title' }, title),
      React.createElement('div', { className: 'renoise-card__meta' }, `${d.model} · ${d.duration}s · ${d.ratio} · ${d.resolution} · ${d.estimatedCredits} credits`))),
    d.videoUrl && React.createElement('video', { className: 'renoise-card__media', src: d.videoUrl, controls: true, preload: 'metadata' }),
    d.status === 'running' && React.createElement('div', { className: 'renoise-card__meta', role: 'status' }, 'Renoise is creating your video…'),
    d.error && React.createElement('div', { className: 'renoise-card__meta', role: 'alert' }, d.error),
    d.status !== 'running' && React.createElement('div', { className: 'renoise-card__actions' },
      React.createElement('button', { className: 'renoise-card__button', type: 'button', onClick: () => copy('Retry the Renoise video generation with the same approved settings.') }, 'Copy retry prompt'),
      React.createElement('button', { className: 'renoise-card__button', type: 'button', onClick: () => copy('Continue this Renoise video into the next shot while preserving visual continuity.') }, 'Copy continue prompt'))))
}

exports.inject = ['conversationEvents', 'slots']
exports.apply = function apply(ctx) {
  ctx.conversationEvents.register(definition)
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'renoise/generation' }, GenerationCard))
}
return module.exports; } });
