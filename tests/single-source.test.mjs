import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { compareVersions, expectedChecksum, hasRequiredCommands, planFromManifest, platformInfo, selectArchive } from '../skills/renoise-setup/scripts/install-cli.mjs';

const readJSON = (path) => JSON.parse(readFileSync(path, 'utf8'));
const removed = [
  'skills/renoise-gen/renoise-cli.mjs',
  'skills/renoise-gen/renoise-cli-legacy.mjs',
  'skills/renoise-gen/credential.mjs',
  'skills/renoise-gen/references/api-endpoints.md',
  'skills/renoise-gen/references/video-capabilities.md',
  'hooks/hooks.json',
  'hooks/session-start.sh',
];

test('native CLI remains the only runtime and capability source', () => {
  for (const path of removed) assert.equal(existsSync(path), false, `${path} must not return`);
  for (const path of ['skills/director/SKILL.md', 'skills/renoise-gen/SKILL.md', 'skills/storyboard-sheet/SKILL.md']) {
    assert.match(readFileSync(path, 'utf8'), /renoise model --json/, `${path} must use live models`);
  }
  const toolSkill = readFileSync('skills/renoise-gen/SKILL.md', 'utf8');
  assert.doesNotMatch(toolSkill, /## Supported Models|\/api\/public\/v1\/tasks/);
  assert.match(toolSkill, /user-invocable: false/);
});

test('package metadata is the manifest source of truth', () => {
  const pkg = readJSON('package.json');
  const manifests = [
    readJSON('.claude-plugin/plugin.json'),
    readJSON('.codex-plugin/plugin.json'),
    readJSON('openclaw.plugin.json'),
  ];
  for (const manifest of manifests) {
    assert.equal(manifest.version, pkg.version);
    assert.equal(manifest.description, pkg.description);
  }

  const claudeMarketplacePlugin = readJSON('.claude-plugin/marketplace.json').plugins[0];
  assert.equal(claudeMarketplacePlugin.version, pkg.version);
  assert.equal(claudeMarketplacePlugin.description, pkg.description);

  const codex = manifests[1];
  assert.equal(codex.skills, './skills/');
  assert.ok(existsSync(codex.interface.composerIcon));
  assert.ok(existsSync(codex.interface.logo));
  assert.match(readFileSync(codex.interface.logo, 'utf8'), /<rect[^>]+fill="#2B2B2B"/);

  const marketplace = readJSON('.agents/plugins/marketplace.json');
  assert.equal(marketplace.plugins[0].name, codex.name);
  assert.equal(marketplace.plugins[0].source.url, pkg.repository.url);
  assert.equal(marketplace.plugins[0].policy.authentication, 'ON_USE');
});

test('desktop metadata exposes four primary entries and workflows recover through setup', () => {
  const entries = {
    director: 'Create with Renoise',
    'gemini-gen': 'Analyze Media',
    'storyboard-sheet': 'Build Storyboard',
    'renoise-setup': 'Setup / Account',
  };
  for (const [skill, displayName] of Object.entries(entries)) {
    const metadata = readFileSync(`skills/${skill}/agents/openai.yaml`, 'utf8');
    assert.match(metadata, new RegExp(`display_name: "${displayName.replace('/', '\\/')}"`));
    assert.match(metadata, new RegExp(`\\$${skill}`));
  }
  assert.match(readFileSync('skills/renoise-setup/agents/openai.yaml', 'utf8'), /allow_implicit_invocation: true/);
  for (const skill of ['director', 'gemini-gen', 'renoise-gen', 'storyboard-sheet']) {
    const instructions = readFileSync(`skills/${skill}/SKILL.md`, 'utf8');
    assert.match(instructions, /renoise-setup\/SKILL\.md/);
    assert.match(instructions, /continue the original request/);
  }
});

test('installer selects and verifies macOS, Windows, and Linux archives', () => {
  const assets = [
    { name: 'renoise-cli_0.2.0_darwin_amd64.tar.gz' },
    { name: 'renoise-cli_0.2.0_darwin_arm64.tar.gz' },
    { name: 'renoise-cli_0.2.0_linux_amd64.tar.gz' },
    { name: 'renoise-cli_0.2.0_linux_arm64.tar.gz' },
    { name: 'renoise-cli_0.2.0_windows_amd64.zip' },
    { name: 'renoise-cli_0.2.0_windows_arm64.zip' },
  ];
  const targets = [
    ['darwin', 'x64'], ['darwin', 'arm64'],
    ['linux', 'x64'], ['linux', 'arm64'],
    ['win32', 'x64'], ['win32', 'arm64'],
  ];
  targets.forEach(([platform, arch], index) => {
    assert.equal(selectArchive(assets, platformInfo(platform, arch, { LOCALAPPDATA: 'C:\\Users\\test' })).name, assets[index].name);
  });
  const plan = planFromManifest({
    schemaVersion: 1,
    version: 'v0.2.0',
    assets: assets.map(({ name }) => name),
    checksums: 'checksums.txt',
  }, platformInfo('darwin', 'arm64'));
  assert.equal(plan.archive.browser_download_url, `https://download.renoise.ai/cli/v0.2.0/${assets[1].name}`);
  assert.equal(expectedChecksum(`${'a'.repeat(64)}  ${assets[0].name}\n`, assets[0].name), 'a'.repeat(64));
  const createHelp = 'Usage: renoise task create\nFlags:\n      --prompt-file string';
  const waitHelp = 'Usage: renoise task wait';
  assert.equal(hasRequiredCommands(createHelp, waitHelp, 'Usage: renoise auth exec', 'Flags:\n      --web'), true);
  assert.equal(hasRequiredCommands('Usage: renoise task create', waitHelp, 'Usage: renoise auth exec', 'Flags:\n      --web'), false);
  assert.equal(hasRequiredCommands(createHelp, waitHelp, 'Usage: renoise auth exec', 'Usage: renoise auth login'), false);
  assert.ok(compareVersions('0.3.0', '0.2.0') > 0);
  assert.equal(compareVersions('0.2.0', '0.2.0'), 0);
});

test('setup keeps managed CLI current and still gates manual install', () => {
  const setup = readFileSync('skills/renoise-setup/SKILL.md', 'utf8');
  const gen = readFileSync('skills/renoise-gen/SKILL.md', 'utf8');
  const installer = readFileSync('skills/renoise-setup/scripts/install-cli.mjs', 'utf8');
  assert.match(setup, /https:\/\/download\.renoise\.ai\/cli\/latest\.json/);
  assert.doesNotMatch(setup, /GitHub Releases|go install/);
  assert.match(setup, /--check/);
  assert.match(setup, /--ensure/);
  assert.match(setup, /ask for explicit confirmation/i);
  assert.match(setup, /--install/);
  assert.match(setup, /renoise auth login --web --json/);
  assert.match(setup, /never ask them to open a terminal/);
  assert.match(gen, /install-cli\.mjs" --ensure/);
  assert.match(installer, /--ensure/);
  assert.match(installer, /needsManagedUpdate/);
});
