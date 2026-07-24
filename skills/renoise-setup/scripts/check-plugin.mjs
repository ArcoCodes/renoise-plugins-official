#!/usr/bin/env node
/**
 * Compare the installed plugin package.json version to the latest GitHub Release.
 * Advisory only — hosts own plugin install/update; this just tells the agent what to say.
 *
 * Usage: node check-plugin.mjs
 * Exit: 0 current | 1 error | 2 update available
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions } from './install-cli.mjs';

const REPO = 'ArcoCodes/renoise-plugins-official';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function localVersion() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version || '')) throw new Error(`Invalid local version: ${pkg.version}`);
  return pkg.version;
}

function parseReleaseTag(tag) {
  const match = String(tag || '').match(/^renoise--v(\d+\.\d+\.\d+)$/);
  return match?.[1] || null;
}

async function latestVersion() {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'renoise-plugin-version-check',
    },
  });
  if (!response.ok) throw new Error(`GitHub releases failed (${response.status})`);
  const body = await response.json();
  const version = parseReleaseTag(body.tag_name);
  if (!version) throw new Error(`Unexpected latest release tag: ${body.tag_name}`);
  return { version, tag: body.tag_name, url: body.html_url };
}

function upgradeHelp(from, to) {
  return [
    `Plugin update available: ${from} → ${to}`,
    'Hosts do not always auto-refresh marketplace plugins. Guide the user to update, then restart the host:',
    '- Claude Code: `claude plugin uninstall renoise@renoise-plugins-official; claude plugin install renoise@renoise-plugins-official`',
    '- Claude Desktop / Cowork: Customize → Plugins → Renoise marketplace → update/reinstall **renoise**, then restart',
    '- Codex / ChatGPT Desktop: Plugins → Renoise marketplace → update/reinstall **renoise**, then restart the app',
    '- OpenClaw: `openclaw plugins install @renoise/plugin`',
    'After updating, rerun the original request. Do not pretend the new plugin behavior is already loaded.',
  ].join('\n');
}

async function main() {
  const local = localVersion();
  const latest = await latestVersion();
  console.log(`Plugin local: ${local}`);
  console.log(`Plugin latest: ${latest.version} (${latest.tag})`);
  console.log(`Release: ${latest.url}`);

  if (compareVersions(local, latest.version) >= 0) {
    console.log(local === latest.version ? 'Plugin is current.' : 'Plugin is newer than the latest public release.');
    return;
  }

  console.log(upgradeHelp(local, latest.version));
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(`Plugin version check failed: ${error.message}`);
  process.exitCode = 1;
});
