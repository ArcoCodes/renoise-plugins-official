import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const skippedDirectories = new Set(['.git', 'dist', 'node_modules']);
const dependencyGroups = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const sourceExtensions = /\.(?:c|m)?js$|\.jsx$|\.tsx?$/;
const restrictedImport = /(?:from\s+|import\s*(?:\(\s*)?|require\s*\(\s*)['"](?:tldraw|@tldraw\/)/;

function walkFiles(directory) {
  if (!existsSync(directory)) return [];

  const files = [];
  for (const entryName of readdirSync(directory)) {
    if (skippedDirectories.has(entryName)) continue;
    const entryPath = join(directory, entryName);
    if (statSync(entryPath).isDirectory()) files.push(...walkFiles(entryPath));
    else files.push(entryPath);
  }
  return files;
}

function isRestrictedPackage(packageName) {
  return packageName === 'tldraw' || packageName.startsWith('@tldraw/');
}

test('canvas runtime remains free of production-key tldraw dependencies', () => {
  for (const restrictedSource of [
    "import 'tldraw';",
    "import { Tldraw } from 'tldraw';",
    "await import('@tldraw/assets');",
    "require('tldraw');",
  ]) {
    assert.match(restrictedSource, restrictedImport);
  }

  const packageManifests = walkFiles(repositoryRoot).filter((filePath) => filePath.endsWith('package.json'));

  for (const manifestPath of packageManifests) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const dependencyGroup of dependencyGroups) {
      for (const packageName of Object.keys(manifest[dependencyGroup] ?? {})) {
        assert.equal(
          isRestrictedPackage(packageName),
          false,
          `${relative(repositoryRoot, manifestPath)} must not depend on ${packageName}`,
        );
      }
    }
  }

  for (const sourceDirectory of ['features/canvas', 'mcp', 'src', 'widget']) {
    for (const sourcePath of walkFiles(join(repositoryRoot, sourceDirectory)).filter((filePath) => sourceExtensions.test(filePath))) {
      assert.doesNotMatch(
        readFileSync(sourcePath, 'utf8'),
        restrictedImport,
        `${relative(repositoryRoot, sourcePath)} must not import the tldraw runtime`,
      );
    }
  }
});
