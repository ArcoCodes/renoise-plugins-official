import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const adapter = new URL('../skills/renoise-gen/renoise-cli.mjs', import.meta.url);

function fakeNative() {
  const directory = mkdtempSync(join(tmpdir(), 'renoise-cli-adapter-'));
  const executable = join(directory, 'renoise');
  const log = join(directory, 'args.log');
  writeFileSync(executable, `#!/bin/sh\necho "$@" >> "${log}"\ncase "$1 $2" in\n  "version ") echo 'renoise test' ;;\n  "generate create") echo '{"task":{"id":42,"status":"pending","estimatedCredit":3.5}}' ;;\n  "generate wait") echo '{"taskId":42,"status":"completed","videoUrl":"https://example.test/result.mp4"}' ;;\n  "generate result") echo '{"taskId":42,"status":"completed","videoUrl":"https://example.test/result.mp4"}' ;;\n  "generate chain") echo '{"material":{"id":88,"type":"video"},"action":"created"}' ;;\n  "upload /tmp/reference.png") echo '{"material":{"id":77,"name":"reference.png"},"action":"created"}' ;;\n  *) echo '{}' ;;\nesac\n`);
  chmodSync(executable, 0o755);
  return { executable, log };
}

function run(args, env = {}) {
  return spawnSync(process.execPath, [adapter.pathname, ...args], {
    cwd: root.pathname,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('legacy create syntax delegates to the native CLI', () => {
  const fake = fakeNative();
  const result = run(['task', 'create', '--model', 'seedance-2.0', '--prompt', 'hello', '--duration', '5'], { RENOISE_CLI_PATH: fake.executable });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Task created: id=42/);
  const calls = readFileSync(fake.log, 'utf8');
  assert.match(calls, /generate create seedance-2.0 --prompt hello --duration 5 --json/);
});

test('generate delegates create and wait with duration flags', () => {
  const fake = fakeNative();
  const result = run(['task', 'generate', '--prompt', 'hello', '--interval', '2', '--timeout', '9'], { RENOISE_CLI_PATH: fake.executable });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Done!/);
  const calls = readFileSync(fake.log, 'utf8');
  assert.match(calls, /generate create seedance-2.0 --prompt hello --json/);
  assert.match(calls, /generate wait 42 --json --interval 2s --timeout 9s/);
});

test('result syntax requests native JSON output', () => {
  const fake = fakeNative();
  const result = run(['task', 'result', '42'], { RENOISE_CLI_PATH: fake.executable });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /videoUrl/);
  assert.match(readFileSync(fake.log, 'utf8'), /generate result 42 --json/);
});

test('read-only commands map to native subcommands', () => {
  const fake = fakeNative();
  const env = { RENOISE_CLI_PATH: fake.executable };
  for (const args of [
    ['task', 'list', '--status', 'completed', '--limit', '3'],
    ['material', 'list', '--type', 'image', '--ids', '7,8'],
    ['credit', 'me'],
    ['credit', 'estimate', '--model', 'seedance-2.0', '--duration', '10', '--hasVideoRef'],
    ['credit', 'history', '--limit', '4', '--offset', '2'],
  ]) {
    const result = run(args, env);
    assert.equal(result.status, 0, result.stderr);
  }
  const calls = readFileSync(fake.log, 'utf8');
  assert.match(calls, /generate list --status completed --limit 3/);
  assert.match(calls, /material --type image --ids 7,8/);
  assert.match(calls, /account status --json/);
  assert.match(calls, /generate cost seedance-2.0 --json --duration 10 --has-video-ref/);
  assert.match(calls, /account history --json --limit 4 --offset 2/);
});

test('templates, tags, and chaining delegate to native commands', () => {
  const fake = fakeNative();
  const env = { RENOISE_CLI_PATH: fake.executable };
  for (const args of [
    ['task', 'create', '--model', 'seedance-2.0', '--template-id', '9'],
    ['task', 'tags'],
    ['task', 'tag', '42', '--tags', 'project,shot'],
  ]) {
    const result = run(args, env);
    assert.equal(result.status, 0, result.stderr);
  }
  const chain = run(['task', 'chain', '42'], env);
  assert.equal(chain.status, 0, chain.stderr);
  assert.match(chain.stdout, /Material #88 ready/);

  const calls = readFileSync(fake.log, 'utf8');
  assert.match(calls, /generate create seedance-2.0 --template-id 9 --json/);
  assert.match(calls, /generate tags --json/);
  assert.match(calls, /generate tag 42 --tags project,shot --json/);
  assert.match(calls, /generate chain 42 --json/);
});

test('material upload preserves the legacy parseable ID output', () => {
  const fake = fakeNative();
  const result = run(['material', 'upload', '/tmp/reference.png', '--type', 'image'], { RENOISE_CLI_PATH: fake.executable });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Material uploaded: #77/);
  assert.match(readFileSync(fake.log, 'utf8'), /upload \/tmp\/reference.png --json --type image/);
});

test('legacy fallback remains available when native CLI is absent', () => {
  const result = run(['help'], { RENOISE_FORCE_LEGACY: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /RENOISE CLI/);
});
