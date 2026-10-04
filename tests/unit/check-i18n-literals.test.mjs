// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findLiterals,
  ALLOWLIST,
} from '../../scripts/check-i18n-literals.mjs';

const CLI = fileURLToPath(new URL('../../scripts/check-i18n-literals.mjs', import.meta.url));

test('ALLOWLIST exports expected brand names with justification', () => {
  assert.ok(ALLOWLIST.has('TerribleTurtles'));
  assert.ok(ALLOWLIST.has('GitHub'));
});

test('passes for translation expression {t(locale, ...)}', () => {
  const source = '<a href="/">{t(locale, \'nav.work\')}</a>';
  assert.deepEqual(findLiterals(source, 'test.astro'), []);
});

test('passes for symbol-only text node ↗', () => {
  const source = '<span aria-hidden="true">↗</span>';
  assert.deepEqual(findLiterals(source, 'test.astro'), []);
});

test('passes for allowlisted brand name TerribleTurtles', () => {
  const source = '<span>TerribleTurtles</span>';
  assert.deepEqual(findLiterals(source, 'test.astro'), []);
});

test('passes for allowlisted brand name GitHub', () => {
  const source = '<a href="https://github.com">GitHub</a>';
  assert.deepEqual(findLiterals(source, 'test.astro'), []);
});

test('passes for frontmatter containing English strings', () => {
  const source = `---
const title = "English Title in Frontmatter";
const description = "English description should be ignored";
---
<main>{title}</main>`;
  assert.deepEqual(findLiterals(source, 'test.astro'), []);
});

test('passes for style blocks containing English text', () => {
  const source = `<style>
  .selector::after {
    content: "English text in CSS";
  }
</style>
<div class="selector"></div>`;
  assert.deepEqual(findLiterals(source, 'test.astro'), []);
});

test('passes for ld+json script blocks containing English text', () => {
  const source = `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "English site name"
  }
</script>`;
  assert.deepEqual(findLiterals(source, 'test.astro'), []);
});

test('passes for multi-line nested {cond && (<p>{x}</p>)}', () => {
  const source = `{
  cond && (
    <p>{x}</p>
  )
}`;
  assert.deepEqual(findLiterals(source, 'test.astro'), []);
});

test('passes for HTML entities and symbols (&rarr;, ·, ©)', () => {
  const source = `<span>&rarr;</span>
<span>·</span>
<span>©</span>
<span>&copy; 2026 TerribleTurtles</span>`;
  assert.deepEqual(findLiterals(source, 'test.astro'), []);
});

test('fails for <p>Hello world</p> with line number 1', () => {
  const source = '<p>Hello world</p>';
  assert.deepEqual(findLiterals(source, 'test.astro'), [
    { file: 'test.astro', line: 1, text: 'Hello world' },
  ]);
});

test('fails for <a aria-label="Home page"> with line number 1', () => {
  const source = '<a aria-label="Home page">';
  assert.deepEqual(findLiterals(source, 'test.astro'), [
    { file: 'test.astro', line: 1, text: 'Home page' },
  ]);
});

test('fails for <img alt="Screenshot"> with line number 1', () => {
  const source = '<img alt="Screenshot">';
  assert.deepEqual(findLiterals(source, 'test.astro'), [
    { file: 'test.astro', line: 1, text: 'Screenshot' },
  ]);
});

test('fails for text split across lines with accurate line number', () => {
  const source = `<p>
  Hello
  world
</p>`;
  assert.deepEqual(findLiterals(source, 'test.astro'), [
    { file: 'test.astro', line: 2, text: 'Hello world' },
  ]);
});

test('fails for text after an expression {x} items with accurate line number', () => {
  const source = '<p>{x} items</p>';
  assert.deepEqual(findLiterals(source, 'test.astro'), [
    { file: 'test.astro', line: 1, text: 'items' },
  ]);
});

test('fails for placeholder and title attributes', () => {
  const source = `<input placeholder="Enter name">
<button title="Click me">Submit</button>`;
  assert.deepEqual(findLiterals(source, 'test.astro'), [
    { file: 'test.astro', line: 1, text: 'Enter name' },
    { file: 'test.astro', line: 2, text: 'Click me' },
    { file: 'test.astro', line: 2, text: 'Submit' },
  ]);
});

test('the CLI reports findings and exits 1 on templates with literals', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tt-i18n-'));
  try {
    const file = join(dir, 'example.astro');
    writeFileSync(file, '<p>Hello world</p>\n');
    const run = spawnSync(process.execPath, [CLI, file], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /example\.astro:1  "Hello world"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the CLI exits 0 and prints PASS on compliant templates', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tt-i18n-'));
  try {
    const file = join(dir, 'example.astro');
    writeFileSync(file, '<span>TerribleTurtles</span>\n');
    const run = spawnSync(process.execPath, [CLI, file], { encoding: 'utf8' });
    assert.equal(run.status, 0);
    assert.match(run.stdout, /check-i18n-literals: PASS \(1 files\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
