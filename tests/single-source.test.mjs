import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { compareVersions, expectedChecksum, hasRequiredCommands, planFromManifest, platformInfo, selectArchive } from '../skills/renoise-setup/scripts/install-cli.mjs';

const readJSON = (path) => JSON.parse(readFileSync(path, 'utf8'));

const removed = [
  'skills/renoise-gen',
  'skills/gemini-gen',
  'skills/renoise-cli/renoise-cli.mjs',
  'skills/renoise-cli/renoise-cli-legacy.mjs',
  'skills/renoise-cli/credential.mjs',
  'skills/renoise-cli/references/api-endpoints.md',
  'skills/renoise-cli/references/video-capabilities.md',
  'skills/renoise-cli/scripts/upload.mjs',
  'skills/director/scripts',
  'skills/director/examples',
  'hooks/hooks.json',
  'hooks/session-start.sh',
];

test('skill manifest separates portable creative methods from local execution', () => {
  const manifest = readJSON('skills/manifest.json');
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.pluginVersion, readJSON('package.json').version);

  const byId = new Map(manifest.skills.map((skill) => [skill.id, skill]));
  assert.deepEqual([...byId.keys()].sort(), [
    'director',
    'model-routing',
    'renoise-cli',
    'renoise-setup',
    'storyboard-sheet',
    'video-download',
  ]);
  assert.equal(byId.get('director').runtime, 'portable');
  assert.equal(byId.get('model-routing').runtime, 'portable');
  assert.equal(byId.get('storyboard-sheet').runtime, 'portable');
  for (const id of ['renoise-cli', 'renoise-setup', 'video-download']) {
    assert.equal(byId.get(id).runtime, 'local-cli');
  }
  assert.ok(byId.get('director').requires.includes('tasks.create'));
  assert.ok(byId.get('director').optional.includes('media.analyze'));
  assert.ok(byId.get('storyboard-sheet').optional.includes('tasks.create'));
});

test('portable skill files contain no local execution instructions', () => {
  const manifest = readJSON('skills/manifest.json');
  const forbidden = [
    /allowed-tools:[^\n]*(?:Bash|Write|Edit)/i,
    /```(?:bash|sh|shell|powershell)/i,
    /(?:^|\n)\s*(?:renoise|ffmpeg|curl|wget|node|python|docker)\s+/i,
    /\$\{(?:CLAUDE_SKILL_DIR|CLAUDE_PLUGIN_ROOT)\}/,
    /command -v|Get-Command|prompt-file|Managed Agent Runtime/,
    /`renoise_[a-z]/,
  ];

  for (const skill of manifest.skills.filter((entry) => entry.runtime === 'portable')) {
    assert.ok(skill.files?.length, `${skill.id} must list its portable source files`);
    assert.ok(skill.files.includes(skill.entry), `${skill.id} entry must be portable`);
    for (const path of skill.files) {
      assert.ok(existsSync(path), `${path} must exist`);
      const instructions = readFileSync(path, 'utf8');
      for (const pattern of forbidden) {
        assert.doesNotMatch(instructions, pattern, `${path} must stay runtime-neutral`);
      }
    }
  }
});

test('local renoise-cli remains the only CLI execution skill', () => {
  for (const path of removed) assert.equal(existsSync(path), false, `${path} must not return`);
  const cli = readFileSync('skills/renoise-cli/SKILL.md', 'utf8');
  assert.match(cli, /^name: renoise-cli$/m);
  assert.match(cli, /local-only/i);
  assert.match(cli, /user-invocable: false/);
  assert.match(cli, /renoise model --json/);
  assert.match(cli, /renoise analyze/);
  assert.match(cli, /renoise task create/);
  assert.match(cli, /automatic-duration edit/);
  assert.match(cli, /RENOISE_CLIENT_NAME=codex/);
  assert.match(cli, /`first_frame` anchors the opening/);
  assert.match(cli, /renoise upload/);
  assert.match(cli, /renoise-setup\/SKILL\.md/);
  assert.doesNotMatch(cli, /Managed Agent Runtime|renoise_[a-z]/);
  for (const helper of [
    'analyze-beats.py',
    'batch-generate.sh',
    'generate-preview.mjs',
    'match-materials.mjs',
    'material-ingest.mjs',
    'qc-preview.sh',
    'split-grid.sh',
  ]) {
    assert.ok(existsSync(`skills/renoise-cli/scripts/${helper}`));
  }
});

test('model routing covers every live family without replacing capabilities', () => {
  const routing = readFileSync('skills/model-routing/SKILL.md', 'utf8');
  for (const model of [
    'seedance-2.5-byteplus', 'seedance-2.0-byteplus', 'seedance-2.0-fast-byteplus', 'seedance-2.0-mini-byteplus',
    'nano-banana-2', 'nano-banana-2-lite', 'nano-banana-pro',
    'midjourney-v7', 'mj-v8.1', 'mj-v8.2', 'gpt-image-2',
    'seedream-5-0-lite', 'seedream-5-0-pro', 'happyhorse-1.0', 'kling-3.0-omni',
    'lyria-clip', 'seed-audio-1.0', 'grok-image', 'grok-image-quality',
    'grok-video', 'grok-video-1.5', 'gemini-omni-flash', 'hailuo-h3',
  ]) assert.ok(routing.includes(model), `${model} routing missing`);
  assert.match(routing, /Live model capabilities are authoritative/);
  assert.match(routing, /Do not auto-select/);
});

test('prompt examples use canonical material ID tokens', () => {
  const promptCraft = readFileSync('skills/director/references/prompt-craft.md', 'utf8');
  const cli = readFileSync('skills/renoise-cli/SKILL.md', 'utf8');
  const directorFiles = [
    promptCraft,
    ...['INDEX.md', 'scenario-a-viral.md', 'scenario-b-brand.md', 'scenario-c-tvc.md', 'scenario-d-ugc.md']
      .map((file) => readFileSync(`skills/director/commercial/${file}`, 'utf8')),
  ].join('\n');
  assert.match(promptCraft, /@material:101/);
  assert.match(cli, /@material:<ID>/);
  assert.doesNotMatch(directorFiles, /@(?:Image|Video)\s*\d/i);
  assert.doesNotMatch(directorFiles, /@[\w-]+\.(?:png|jpe?g|webp|mp4|mov)\b/i);
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

test('desktop metadata exposes portable entries plus setup', () => {
  const entries = {
    director: 'Create with Renoise',
    'storyboard-sheet': 'Build Storyboard',
    'renoise-setup': 'Setup / Account',
  };
  for (const [skill, displayName] of Object.entries(entries)) {
    const metadata = readFileSync(`skills/${skill}/agents/openai.yaml`, 'utf8');
    assert.match(metadata, new RegExp(`display_name: "${displayName.replace('/', '\\/')}"`));
    assert.match(metadata, new RegExp(`\\$${skill}`));
  }
  assert.match(readFileSync('skills/renoise-setup/agents/openai.yaml', 'utf8'), /allow_implicit_invocation: true/);
  const openclawSkills = readJSON('openclaw.plugin.json').skills;
  assert.ok(openclawSkills.includes('skills/renoise-cli'));
  assert.ok(!openclawSkills.includes('skills/renoise-gen'));
  assert.ok(!openclawSkills.includes('skills/gemini-gen'));
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
  const analyzeHelp = 'Usage: renoise analyze <image-or-video>\nFlags:\n      --mode string';
  assert.equal(hasRequiredCommands(createHelp, waitHelp, 'Usage: renoise auth exec', 'Flags:\n      --web', analyzeHelp), true);
  assert.equal(hasRequiredCommands('Usage: renoise task create', waitHelp, 'Usage: renoise auth exec', 'Flags:\n      --web', analyzeHelp), false);
  assert.equal(hasRequiredCommands(createHelp, waitHelp, 'Usage: renoise auth exec', 'Usage: renoise auth login', analyzeHelp), false);
  assert.equal(hasRequiredCommands(createHelp, waitHelp, 'Usage: renoise auth exec', 'Flags:\n      --web', 'Usage: renoise analyze'), false);
  assert.ok(compareVersions('0.3.0', '0.2.0') > 0);
  assert.equal(compareVersions('0.2.0', '0.2.0'), 0);
});

test('setup keeps managed CLI current and still gates manual install', () => {
  const setup = readFileSync('skills/renoise-setup/SKILL.md', 'utf8');
  const cli = readFileSync('skills/renoise-cli/SKILL.md', 'utf8');
  const installer = readFileSync('skills/renoise-setup/scripts/install-cli.mjs', 'utf8');
  assert.match(setup, /https:\/\/download\.renoise\.ai\/cli\/latest\.json/);
  assert.doesNotMatch(setup, /GitHub Releases|go install/);
  assert.match(setup, /--check/);
  assert.match(setup, /--ensure/);
  assert.match(setup, /ask for explicit confirmation/i);
  assert.match(setup, /--install/);
  assert.match(setup, /renoise auth login --web --json/);
  assert.match(setup, /never ask them to open a terminal/);
  assert.match(cli, /install-cli\.mjs" --ensure/);
  assert.match(installer, /--ensure/);
  assert.match(installer, /needsManagedUpdate/);
});

test('reference-video remake keeps source attachment and approval gates', () => {
  const director = readFileSync('skills/director/SKILL.md', 'utf8');
  const scenario = readFileSync('skills/director/commercial/scenario-a-viral.md', 'utf8');
  assert.match(director, /剪同款/);
  assert.match(scenario, /media-analysis capability/i);
  assert.match(scenario, /source video is always attached/i);
  assert.match(scenario, /Gate 1/);
  assert.match(scenario, /Gate 2/);
  assert.doesNotMatch(scenario, /renoise analyze|prompt-file|remake-plan\.json/);
});

test('moderation waits for an explicit host error', () => {
  const director = readFileSync('skills/director/SKILL.md', 'utf8');
  const cli = readFileSync('skills/renoise-cli/SKILL.md', 'utf8');
  const scenario = readFileSync('skills/director/commercial/scenario-a-viral.md', 'utf8');
  for (const skill of [director, cli]) {
    assert.match(skill, /Do not pre-screen/);
    assert.match(skill, /INPUT_\*/);
    assert.match(skill, /OUTPUT_\*/);
    assert.doesNotMatch(skill, /hard blocks|First check whether the prompt or materials/);
  }
  assert.match(scenario, /Host returns `INPUT_\*` \/ `OUTPUT_\*`/);
});
