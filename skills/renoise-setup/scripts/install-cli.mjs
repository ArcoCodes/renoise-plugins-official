#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, platform as hostPlatform, arch as hostArch, tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RELEASE_INDEX = 'https://download.renoise.ai/cli/latest.json';
const DOWNLOAD_ROOT = 'https://download.renoise.ai/cli';

export function platformInfo(platform = hostPlatform(), arch = hostArch(), env = process.env) {
  const platforms = {
    darwin: { release: ['darwin', 'macos'], label: 'macOS', extension: '.tar.gz', binary: 'renoise' },
    linux: { release: ['linux'], label: 'Linux', extension: '.tar.gz', binary: 'renoise' },
    win32: { release: ['windows'], label: 'Windows', extension: '.zip', binary: 'renoise.exe' },
  };
  const arches = {
    x64: { release: ['amd64', 'x86_64'], label: 'x64' },
    arm64: { release: ['arm64', 'aarch64'], label: 'ARM64' },
  };
  if (!platforms[platform] || !arches[arch]) throw new Error(`Unsupported platform: ${platform}/${arch}`);

  const binDir = platform === 'win32'
    ? join(env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Renoise', 'bin')
    : join(homedir(), '.local', 'bin');
  return { ...platforms[platform], arch: arches[arch], binDir, target: join(binDir, platforms[platform].binary) };
}

export function selectArchive(assets, info) {
  const matches = assets.filter(({ name }) => {
    const lower = name.toLowerCase();
    return lower.endsWith(info.extension)
      && info.release.some((value) => lower.includes(value))
      && info.arch.release.some((value) => lower.includes(value));
  });
  if (matches.length !== 1) throw new Error(`Expected one ${info.label}/${info.arch.label} release archive, found ${matches.length}`);
  return matches[0];
}

export function expectedChecksum(text, filename) {
  const line = text.split(/\r?\n/).find((entry) => entry.trim().endsWith(`  ${filename}`) || entry.trim().endsWith(` *${filename}`));
  const hash = line?.trim().split(/\s+/)[0];
  if (!/^[a-f\d]{64}$/i.test(hash || '')) throw new Error(`No SHA-256 checksum found for ${filename}`);
  return hash.toLowerCase();
}

async function fetchResponse(url) {
  const response = await fetch(url, { headers: { Accept: '*/*', 'User-Agent': 'renoise-cli-installer' } });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return response;
}

export function planFromManifest(manifest, info = platformInfo()) {
  if (manifest?.schemaVersion !== 1 || !/^v\d+\.\d+\.\d+$/.test(manifest.version || '')) {
    throw new Error('Invalid Renoise CLI release manifest');
  }
  const names = manifest.assets;
  if (!Array.isArray(names) || names.some((name) => typeof name !== 'string' || !/^[\w.-]+$/.test(name))) {
    throw new Error('Invalid Renoise CLI release assets');
  }
  const checksumsName = manifest.checksums;
  if (typeof checksumsName !== 'string' || !/^[\w.-]+$/.test(checksumsName)) {
    throw new Error('Invalid Renoise CLI checksums asset');
  }
  const base = `${DOWNLOAD_ROOT}/${manifest.version}`;
  const archive = selectArchive(names.map((name) => ({ name })), info);
  archive.browser_download_url = `${base}/${archive.name}`;
  return {
    info,
    release: { tag_name: manifest.version },
    archive,
    checksums: { name: checksumsName, browser_download_url: `${base}/${checksumsName}` },
  };
}

async function releasePlan() {
  const plan = planFromManifest(await (await fetchResponse(RELEASE_INDEX)).json());
  return { ...plan, installed: inspectInstalled(plan.info) };
}

function findBinary(directory, binary) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = findBinary(path, binary);
      if (found) return found;
    } else if (entry.name === binary) return path;
  }
}

function extract(archive, destination, platform) {
  try {
    execFileSync('tar', ['-xf', archive, '-C', destination], { stdio: 'pipe' });
  } catch (error) {
    if (platform !== 'win32') throw new Error('Could not extract the archive with tar');
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Expand-Archive -LiteralPath $env:RENOISE_ARCHIVE -DestinationPath $env:RENOISE_DEST',
    ], { env: { ...process.env, RENOISE_ARCHIVE: archive, RENOISE_DEST: destination }, stdio: 'pipe' });
  }
}

export function hasRequiredCommands(generationHelp, authHelp, loginHelp) {
  return generationHelp.includes('renoise generate run')
    && authHelp.includes('renoise auth exec')
    && loginHelp.includes('--web');
}

export function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function verify(target) {
  execFileSync(target, ['version'], { stdio: 'pipe' });
  const generationHelp = execFileSync(target, ['help', 'generate', 'run'], { encoding: 'utf8' });
  const authHelp = execFileSync(target, ['help', 'auth', 'exec'], { encoding: 'utf8' });
  const loginHelp = execFileSync(target, ['help', 'auth', 'login'], { encoding: 'utf8' });
  if (!hasRequiredCommands(generationHelp, authHelp, loginHelp)) throw new Error('Release is incompatible: generate run, auth exec, and browser login are required');
}

function findOnPath(binary) {
  const extensions = hostPlatform() === 'win32' ? (process.env.PATHEXT || '.EXE').split(';') : [''];
  for (const directory of (process.env.PATH || '').split(delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = join(directory, binary.toLowerCase().endsWith(extension.toLowerCase()) ? binary : binary + extension.toLowerCase());
      if (existsSync(candidate)) return resolve(candidate);
    }
  }
}

function inspectInstalled(info) {
  const path = existsSync(info.target) ? resolve(info.target) : findOnPath(info.binary);
  if (!path) return null;
  try {
    const versionOutput = execFileSync(path, ['version'], { encoding: 'utf8' }).trim();
    const generationHelp = execFileSync(path, ['help', 'generate', 'run'], { encoding: 'utf8' });
    const authHelp = execFileSync(path, ['help', 'auth', 'exec'], { encoding: 'utf8' });
    const loginHelp = execFileSync(path, ['help', 'auth', 'login'], { encoding: 'utf8' });
    return {
      path,
      version: versionOutput.match(/\b(v?\d+\.\d+\.\d+)\b/)?.[1]?.replace(/^v/, '') || 'unknown',
      versionOutput,
      compatible: hasRequiredCommands(generationHelp, authHelp, loginHelp),
    };
  } catch {
    return { path, version: 'unknown', versionOutput: 'unreadable', compatible: false };
  }
}

function pathMessage(info) {
  const active = findOnPath(info.binary);
  if (active && active !== resolve(info.target)) return `PATH still resolves renoise to ${active}. Put ${info.binDir} before that directory, then restart the Desktop app.`;
  if (active) return `The installed binary is on PATH. Restart the Desktop app if it was open.`;
  if (hostPlatform() === 'win32') return `Add ${info.binDir} to your user PATH in Windows Settings, then restart the Desktop app.`;
  return `Add this to your shell profile, then restart the Desktop app: export PATH="$HOME/.local/bin:$PATH"`;
}

async function install(plan) {
  const work = mkdtempSync(join(tmpdir(), 'renoise-cli-'));
  try {
    const archivePath = join(work, plan.archive.name);
    const checksumText = await (await fetchResponse(plan.checksums.browser_download_url)).text();
    writeFileSync(archivePath, Buffer.from(await (await fetchResponse(plan.archive.browser_download_url)).arrayBuffer()));

    const actual = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
    const expected = expectedChecksum(checksumText, plan.archive.name);
    if (actual !== expected) throw new Error(`Checksum mismatch for ${plan.archive.name}`);

    const extracted = join(work, 'extracted');
    mkdirSync(extracted);
    extract(archivePath, extracted, hostPlatform());
    const binary = findBinary(extracted, plan.info.binary);
    if (!binary) throw new Error(`${plan.info.binary} was not found in ${plan.archive.name}`);

    mkdirSync(plan.info.binDir, { recursive: true });
    const temporaryTarget = `${plan.info.target}.tmp-${process.pid}`;
    const backupTarget = `${plan.info.target}.backup-${process.pid}`;
    copyFileSync(binary, temporaryTarget);
    if (hostPlatform() !== 'win32') chmodSync(temporaryTarget, 0o755);
    verify(temporaryTarget);

    if (existsSync(plan.info.target)) copyFileSync(plan.info.target, backupTarget);
    try {
      rmSync(plan.info.target, { force: true });
      renameSync(temporaryTarget, plan.info.target);
      verify(plan.info.target);
      rmSync(backupTarget, { force: true });
    } catch (error) {
      rmSync(plan.info.target, { force: true });
      if (existsSync(backupTarget)) renameSync(backupTarget, plan.info.target);
      throw error;
    } finally {
      rmSync(temporaryTarget, { force: true });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function main() {
  const mode = process.argv[2] || '--check';
  if (!['--check', '--install'].includes(mode)) throw new Error('Usage: install-cli.mjs [--check|--install]');

  const plan = await releasePlan();
  const latestVersion = plan.release.tag_name.replace(/^v/, '');
  console.log(`Platform: ${plan.info.label} ${plan.info.arch.label}`);
  console.log(`Installed: ${plan.installed ? `${plan.installed.versionOutput} at ${plan.installed.path} (${plan.installed.compatible ? 'compatible' : 'incompatible'})` : 'not found'}`);
  console.log(`Latest release: ${plan.release.tag_name}`);
  console.log(`Archive: ${plan.archive.name}`);
  console.log(`Target: ${plan.info.target}${existsSync(plan.info.target) ? ' (will replace existing file)' : ''}`);

  if (mode === '--check') {
    console.log('No files changed. Run again with --install only after the user explicitly approves this install or update.');
    return;
  }

  if (plan.installed && plan.installed.version !== 'unknown' && compareVersions(plan.installed.version, latestVersion) >= 0) {
    if (!plan.installed.compatible) throw new Error(`Installed CLI ${plan.installed.version} does not satisfy the plugin contract and no newer public release is available`);
    console.log(`${plan.installed.version === latestVersion ? 'Already current' : 'Installed version is newer than the latest release'} and compatible: ${plan.installed.path}`);
    return;
  }

  await install(plan);
  console.log(`Installed and verified: ${plan.info.target}`);
  console.log(pathMessage(plan.info));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(`Renoise CLI install failed: ${error.message}`);
    process.exitCode = 1;
  });
}
