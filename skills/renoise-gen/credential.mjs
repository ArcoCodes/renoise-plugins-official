import { readFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

function configDirectory() {
  if (process.env.RENOISE_CONFIG_DIR) return process.env.RENOISE_CONFIG_DIR;
  if (platform() === 'darwin') return join(homedir(), 'Library', 'Application Support', 'renoise');
  if (platform() === 'win32') return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'renoise');
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'renoise');
}

export function resolveAPIKey() {
  const environmentKey = process.env.RENOISE_API_KEY?.trim();
  if (environmentKey) return environmentKey;
  try {
    const { api_key: savedKey } = JSON.parse(readFileSync(join(configDirectory(), 'credentials.json'), 'utf8'));
    if (typeof savedKey === 'string' && savedKey.trim()) return savedKey.trim();
  } catch {}
  throw new Error('Not authenticated. Run `renoise auth login` or set RENOISE_API_KEY.');
}
