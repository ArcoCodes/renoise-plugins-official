import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveAPIKey } from '../skills/renoise-gen/credential.mjs';

test('credential resolver shares native CLI login and prefers the environment', () => {
  const directory = mkdtempSync(join(tmpdir(), 'renoise-credential-'));
  writeFileSync(join(directory, 'credentials.json'), '{"api_key":"fk_saved"}\n', { mode: 0o600 });
  const previousDirectory = process.env.RENOISE_CONFIG_DIR;
  const previousKey = process.env.RENOISE_API_KEY;
  try {
    process.env.RENOISE_CONFIG_DIR = directory;
    delete process.env.RENOISE_API_KEY;
    assert.equal(resolveAPIKey(), 'fk_saved');
    process.env.RENOISE_API_KEY = 'fk_environment';
    assert.equal(resolveAPIKey(), 'fk_environment');
  } finally {
    if (previousDirectory === undefined) delete process.env.RENOISE_CONFIG_DIR;
    else process.env.RENOISE_CONFIG_DIR = previousDirectory;
    if (previousKey === undefined) delete process.env.RENOISE_API_KEY;
    else process.env.RENOISE_API_KEY = previousKey;
  }
});
