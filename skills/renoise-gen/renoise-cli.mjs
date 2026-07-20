#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const legacyPath = fileURLToPath(new URL('./renoise-cli-legacy.mjs', import.meta.url));
const nativePath = process.env.RENOISE_CLI_PATH || 'renoise';
const argv = process.argv.slice(2);

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options });
}

function forward(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

function runLegacy() {
  const result = spawnSync(process.execPath, [legacyPath, ...argv], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

function hasNativeCLI() {
  if (process.env.RENOISE_FORCE_LEGACY === '1') return false;
  const result = run(nativePath, ['version']);
  return !result.error && result.status === 0;
}

function parseArgs(args) {
  const flags = new Map();
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    const equals = value.indexOf('=');
    if (equals > 2) {
      flags.set(value.slice(2, equals), value.slice(equals + 1));
      continue;
    }
    const next = args[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(value.slice(2), next);
      index += 1;
    } else {
      flags.set(value.slice(2), 'true');
    }
  }
  return { flags, positional };
}

function duration(value) {
  if (!value || /[a-z]/i.test(value)) return value;
  return `${value}s`;
}

function addFlag(output, flags, legacyName, nativeName = legacyName, transform = (value) => value) {
  if (!flags.has(legacyName)) return;
  const value = transform(flags.get(legacyName));
  if (value === true || value === 'true') output.push(`--${nativeName}`);
  else if (value !== false && value !== 'false' && value !== undefined) output.push(`--${nativeName}`, String(value));
}

function addGlobalFlags(output, flags) {
  addFlag(output, flags, 'base-url');
}

function createArgs(flags, json = false) {
  let model = flags.get('model');
  const type = flags.get('type');
  if (!model && (!type || type === 'video')) model = 'seedance-2.0';
  if (!model && type === 'image') model = 'seedream-5-0-pro';
  if (!model) return null;

  const output = ['generate', 'create', model];
  for (const name of ['prompt', 'type', 'duration', 'ratio', 'resolution', 'materials', 'tags']) addFlag(output, flags, name);
  if (flags.has('template-id')) addFlag(output, flags, 'template-id');
  else addFlag(output, flags, 'template_id', 'template-id');
  addFlag(output, flags, 'watermark');
  if (flags.has('no-audio-generation')) output.push('--audio-generation=false');
  else {
    const audioValue = flags.get('audio-generation') ?? flags.get('audioGeneration') ?? flags.get('audio_generation');
    if (audioValue !== undefined) output.push(`--audio-generation=${['1', 'true'].includes(audioValue)}`);
  }
  addGlobalFlags(output, flags);
  if (json) output.push('--json');
  return output;
}

function taskArgs(action, positional, flags) {
  const id = positional[0];
  switch (action) {
    case 'list': {
      const output = ['generate', 'list'];
      for (const name of ['status', 'tag', 'type', 'provider', 'ids', 'limit', 'offset']) addFlag(output, flags, name);
      addGlobalFlags(output, flags);
      return output;
    }
    case 'get':
    case 'result':
    case 'cancel': {
      if (!id) return null;
      const output = ['generate', action, id];
      if (action !== 'cancel') output.push('--json');
      addGlobalFlags(output, flags);
      return output;
    }
    case 'wait': {
      if (!id) return null;
      const output = ['generate', 'wait', id, '--json'];
      addFlag(output, flags, 'interval', 'interval', duration);
      addFlag(output, flags, 'timeout', 'timeout', duration);
      addGlobalFlags(output, flags);
      return output;
    }
    case 'tags': {
      const output = ['generate', 'tags', '--json'];
      addGlobalFlags(output, flags);
      return output;
    }
    case 'tag': {
      if (!id || !flags.has('tags')) return null;
      const output = ['generate', 'tag', id, '--tags', flags.get('tags'), '--json'];
      addGlobalFlags(output, flags);
      return output;
    }
    default:
      return null;
  }
}

function materialArgs(action, positional, flags) {
  if (action === 'upload') {
    if (!positional[0]) return null;
    const output = ['upload', positional[0]];
    addFlag(output, flags, 'type');
    addGlobalFlags(output, flags);
    return output;
  }
  if (action === 'list') {
    const output = ['material'];
    for (const name of ['type', 'search', 'ids', 'limit', 'offset']) addFlag(output, flags, name);
    if (flags.has('id')) output.push('--ids', flags.get('id'));
    addGlobalFlags(output, flags);
    return output;
  }
  return null;
}

function creditArgs(action, flags) {
  if (action === 'me') {
    const output = ['account', 'status', '--json'];
    addGlobalFlags(output, flags);
    return output;
  }
  if (action === 'history') {
    const output = ['account', 'history', '--json'];
    for (const name of ['limit', 'offset']) addFlag(output, flags, name);
    addGlobalFlags(output, flags);
    return output;
  }
  if (action === 'estimate') {
    const model = flags.get('model') || 'seedance-2.0';
    const output = ['generate', 'cost', model, '--json'];
    for (const name of ['duration', 'resolution', 'variant']) addFlag(output, flags, name);
    addFlag(output, flags, 'hasVideoRef', 'has-video-ref');
    addFlag(output, flags, 'watermark');
    addGlobalFlags(output, flags);
    return output;
  }
  return null;
}

function parseJSONOutput(result) {
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function createWithNative(flags) {
  const nativeArgs = createArgs(flags, true);
  if (!nativeArgs) return false;
  const result = run(nativePath, nativeArgs);
  const data = parseJSONOutput(result);
  if (!data?.task?.id) process.exit(forward(result));
  console.log(`Task created: id=${data.task.id}, status=${data.task.status}`);
  if (data.task.estimatedCredit) console.log(`Cost: ${data.task.estimatedCredit} credits`);
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

function uploadWithNative(positional, flags) {
  if (!positional[0]) return false;
  const nativeArgs = ['upload', positional[0], '--json'];
  addFlag(nativeArgs, flags, 'type');
  addGlobalFlags(nativeArgs, flags);
  const result = run(nativePath, nativeArgs);
  const data = parseJSONOutput(result);
  const material = data?.material || data;
  if (!material?.id) process.exit(forward(result));
  console.log(`Material ${data.action === 'exists' ? 'already exists' : 'uploaded'}: #${material.id}`);
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

function chainWithNative(positional, flags) {
  if (!positional[0]) return false;
  const nativeArgs = ['generate', 'chain', positional[0], '--json'];
  addGlobalFlags(nativeArgs, flags);
  const result = run(nativePath, nativeArgs);
  const data = parseJSONOutput(result);
  const material = data?.material || data;
  if (!material?.id) process.exit(forward(result));
  console.log(`Material #${material.id} ready.`);
  console.log(`Use as: --materials "${material.id}:ref_${material.type || 'video'}"`);
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

function generateWithNative(flags) {
  const nativeArgs = createArgs(flags, true);
  if (!nativeArgs) return false;
  console.log('Creating task...');
  const created = run(nativePath, nativeArgs);
  const data = parseJSONOutput(created);
  if (!data?.task?.id) process.exit(forward(created));
  console.log(`Task #${data.task.id} created (${data.task.status}). Waiting for completion...`);
  if (data.task.estimatedCredit) console.log(`Cost: ${data.task.estimatedCredit} credits`);

  const waitArgs = ['generate', 'wait', String(data.task.id), '--json'];
  addFlag(waitArgs, flags, 'interval', 'interval', duration);
  addFlag(waitArgs, flags, 'timeout', 'timeout', duration);
  addGlobalFlags(waitArgs, flags);
  const waited = run(nativePath, waitArgs);
  if (waited.status === 0) console.log('\nDone!');
  process.exit(forward(waited));
}

function main() {
  if (!hasNativeCLI()) runLegacy();

  const { flags, positional } = parseArgs(argv);
  const [domain, action, ...rest] = positional;
  if (domain === 'task' && action === 'create' && createWithNative(flags) !== false) return;
  if (domain === 'task' && action === 'generate' && generateWithNative(flags) !== false) return;
  if (domain === 'task' && action === 'chain' && chainWithNative(rest, flags) !== false) return;
  if (domain === 'material' && action === 'upload' && uploadWithNative(rest, flags) !== false) return;

  let nativeArgs = null;
  if (domain === 'task') nativeArgs = taskArgs(action, rest, flags);
  else if (domain === 'material') nativeArgs = materialArgs(action, rest, flags);
  else if (domain === 'credit') nativeArgs = creditArgs(action, flags);

  // Keep any future unsupported action working through the bundled implementation.
  if (!nativeArgs) runLegacy();
  process.exit(forward(run(nativePath, nativeArgs, { stdio: 'inherit', encoding: undefined })));
}

main();
