// Builds the ChatGPT Directory upload from the plugin's own plugin.json and mcp.json (no second copy of either):
// the directory takes exactly one remote MCP server and portable skills only, so local servers and skills are left out
// and the remote server points at its ChatGPT entry (no shell tools, no purchase links: spec/mcp/01-apps.md §6.6).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const readJSON = (path) => JSON.parse(readFileSync(`${root}${path}`, 'utf8'));
const plugin = readJSON('plugin.json');
const mcp = readJSON('mcp.json');
const { interface: listing, review } = plugin.extensions['com.openai'];

// Listing limits from https://developers.openai.com/plugins/deploy/submission: an over-limit field fails the upload.
assert.match(plugin.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
assert.ok(listing.displayName.length <= 30 && listing.shortDescription.length <= 30, 'displayName / shortDescription ≤ 30');
assert.ok(listing.longDescription.length <= 4000 && listing.developerName.length <= 80);
assert.ok(listing.defaultPrompt.length <= 3 && listing.defaultPrompt.every((prompt) => prompt.length <= 128));
assert.equal(review.test_cases.positive.length, 5, 'five positive review cases');
assert.equal(review.test_cases.negative.length, 3, 'three negative review cases');
assert.ok(!('test_credentials' in review) && !('reviewer_instructions' in review), 'credentials go in the dashboard, never the ZIP');

const remote = Object.entries(mcp.mcpServers).filter(([, server]) => server.type === 'streamable-http');
assert.equal(remote.length, 1, 'exactly one remote MCP server');
const [[name, server]] = remote;

const stage = `${root}dist/openai-plugin`;
rmSync(`${root}dist`, { recursive: true, force: true });
mkdirSync(`${stage}/assets`, { recursive: true });
writeFileSync(`${stage}/plugin.json`, `${JSON.stringify(plugin, null, 2)}\n`);
writeFileSync(`${stage}/mcp.json`, `${JSON.stringify({ ...mcp, mcpServers: { [name]: { ...server, url: `${server.url}/chatgpt` } } }, null, 2)}\n`);
cpSync(`${root}assets/icon.svg`, `${stage}/assets/icon.svg`);
for (const skill of readJSON('skills/manifest.json').skills.filter(({ runtime }) => runtime === 'portable')) {
  cpSync(`${root}skills/${skill.id}`, `${stage}/skills/${skill.id}`, { recursive: true });
}
const zip = `${root}dist/renoise-openai-${plugin.version}.zip`;
execFileSync('zip', ['-qr', zip, '.'], { cwd: stage });
console.log(zip);
