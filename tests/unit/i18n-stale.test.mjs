// Unit tests for stale-translation check and stamping script. Written first (TDD).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPolicy } from '../../scripts/lib/policy.mjs';
import { hashSource, normalize, findStale } from '../../scripts/lib/i18n-stale.mjs';
import { stampLocale } from '../../scripts/i18n-stamp.mjs';
import { writeTreeFile } from './helpers/fixture-coverage.mjs';

const policy = loadPolicy();

/**
 * Creates a minimal temporary test tree with compliant en & es translations.
 * @returns {string} root directory
 */
function makeStaleFixtureTree() {
  const root = mkdtempSync(join(tmpdir(), 'tt-stale-test-'));

  const enAbout = '---\ntitle: "About"\ndescription: "About us"\n---\n\nEnglish About Body.\n';
  const enHash = hashSource(enAbout);
  writeTreeFile(root, 'src/content/pages/en/about.md', enAbout);
  writeTreeFile(
    root,
    'src/content/pages/es/about.md',
    `---\ntitle: "Sobre mí"\ndescription: "Sobre nosotros"\nsource: "${enHash}"\n---\n\nSpanish About Body.\n`
  );

  const enProj = '---\ntitle: "SpellcastersDB"\nsummary: "A project"\n---\n\nProject body.\n';
  const enProjHash = hashSource(enProj);
  writeTreeFile(root, 'src/content/projects/spellcastersdb.md', enProj);
  writeTreeFile(
    root,
    'src/content/projects-i18n/es/spellcastersdb.md',
    `---\ntitle: "SpellcastersDB"\nsummary: "Un proyecto"\nsource: "${enProjHash}"\n---\n\nSpanish project body.\n`
  );

  const enUiBlock = `\n  'brand.home': 'Home',\n  'brand.about': 'About',\n`;
  const enUiHash = hashSource(enUiBlock);
  const uiContent = [
    `// Stale-translation check hashes the normalised text between 'const en = {' and '} as const;'.`,
    `const en = {${enUiBlock}} as const;`,
    ``,
    `export type UiKey = keyof typeof en;`,
    ``,
    `export const UI_SOURCE_HASH = {`,
    `  es: '${enUiHash}',`,
    `} as const;`,
    ``,
  ].join('\n');
  writeTreeFile(root, 'src/i18n/ui.ts', uiContent);

  return root;
}

test('normalize and hashSource strip CRLF, line trailing whitespace, and trailing newlines', () => {
  const raw1 = 'hello world   \r\nline two \t \r\n\r\n\r\n';
  const raw2 = 'hello world\nline two\n';
  const raw3 = 'hello world\nline two';

  assert.equal(normalize(raw1), 'hello world\nline two');
  assert.equal(normalize(raw2), 'hello world\nline two');
  assert.equal(normalize(raw3), 'hello world\nline two');

  assert.equal(hashSource(raw1), hashSource(raw2));
  assert.equal(hashSource(raw2), hashSource(raw3));
  assert.match(hashSource(raw1), /^[a-f0-9]{64}$/);
});

test('findStale passes with zero failures on a fresh compliant tree', () => {
  const root = makeStaleFixtureTree();
  try {
    const failures = findStale({ root, policy });
    assert.deepEqual(failures, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findStale fails when English page source changes without updating translation', () => {
  const root = makeStaleFixtureTree();
  try {
    const enAboutPath = join(root, 'src/content/pages/en/about.md');
    writeFileSync(enAboutPath, '---\ntitle: "About Updated"\ndescription: "About us"\n---\n\nEnglish About Body.\n', 'utf8');

    const failures = findStale({ root, policy });
    assert.equal(failures.length, 1);
    assert.equal(
      failures[0],
      'translation stale: es/about (English changed; update the translation, then npm run i18n:stamp -- es)'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findStale fails when page translation is missing source hash', () => {
  const root = makeStaleFixtureTree();
  try {
    const esAboutPath = join(root, 'src/content/pages/es/about.md');
    writeFileSync(esAboutPath, '---\ntitle: "Sobre mí"\ndescription: "Sobre nosotros"\n---\n\nSpanish About Body.\n', 'utf8');

    const failures = findStale({ root, policy });
    assert.equal(failures.length, 1);
    assert.equal(
      failures[0],
      'translation missing source hash: es/about (run npm run i18n:stamp -- es after translating)'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findStale fails when English project source changes without updating translation', () => {
  const root = makeStaleFixtureTree();
  try {
    const enProjPath = join(root, 'src/content/projects/spellcastersdb.md');
    writeFileSync(enProjPath, '---\ntitle: "SpellcastersDB"\nsummary: "Updated summary"\n---\n\nProject body.\n', 'utf8');

    const failures = findStale({ root, policy });
    assert.equal(failures.length, 1);
    assert.equal(
      failures[0],
      'translation stale: es/work/spellcastersdb (English changed; update the translation, then npm run i18n:stamp -- es)'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findStale fails when project translation is missing source hash', () => {
  const root = makeStaleFixtureTree();
  try {
    const esProjPath = join(root, 'src/content/projects-i18n/es/spellcastersdb.md');
    writeFileSync(esProjPath, '---\ntitle: "SpellcastersDB"\nsummary: "Un proyecto"\n---\n\nSpanish project body.\n', 'utf8');

    const failures = findStale({ root, policy });
    assert.equal(failures.length, 1);
    assert.equal(
      failures[0],
      'translation missing source hash: es/work/spellcastersdb (run npm run i18n:stamp -- es after translating)'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findStale fails when English dictionary changes without updating UI_SOURCE_HASH', () => {
  const root = makeStaleFixtureTree();
  try {
    const uiPath = join(root, 'src/i18n/ui.ts');
    const staleHash = 'a'.repeat(64);
    const modifiedUi = [
      `// Stale-translation check hashes the normalised text between 'const en = {' and '} as const;'.`,
      `const en = {`,
      `  'brand.home': 'Home',`,
      `  'brand.about': 'About modified',`,
      `} as const;`,
      ``,
      `export type UiKey = keyof typeof en;`,
      ``,
      `export const UI_SOURCE_HASH = {`,
      `  es: '${staleHash}',`,
      `} as const;`,
      ``,
    ].join('\n');
    writeFileSync(uiPath, modifiedUi, 'utf8');

    const failures = findStale({ root, policy });
    assert.equal(failures.length, 1);
    assert.equal(
      failures[0],
      'translation stale: es/ui (English changed; update the translation, then npm run i18n:stamp -- es)'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findStale fails when UI_SOURCE_HASH is missing for a locale', () => {
  const root = makeStaleFixtureTree();
  try {
    const uiPath = join(root, 'src/i18n/ui.ts');
    const modifiedUi = [
      `// Stale-translation check hashes the normalised text between 'const en = {' and '} as const;'.`,
      `const en = {`,
      `  'brand.home': 'Home',`,
      `} as const;`,
      ``,
      `export type UiKey = keyof typeof en;`,
      ``,
    ].join('\n');
    writeFileSync(uiPath, modifiedUi, 'utf8');

    const failures = findStale({ root, policy });
    assert.equal(failures.length, 1);
    assert.equal(
      failures[0],
      'translation missing source hash: es/ui (run npm run i18n:stamp -- es after translating)'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('stampLocale stamps fresh hashes on stale/missing translations and ui', () => {
  const root = makeStaleFixtureTree();
  try {
    // Break page, project, and UI
    writeFileSync(
      join(root, 'src/content/pages/en/about.md'),
      '---\ntitle: "About 2"\ndescription: "About us"\n---\n\nEnglish About Body 2.\n',
      'utf8'
    );
    writeFileSync(
      join(root, 'src/content/projects/spellcastersdb.md'),
      '---\ntitle: "SpellcastersDB 2"\nsummary: "Project 2"\n---\n\nBody 2.\n',
      'utf8'
    );
    const uiPath = join(root, 'src/i18n/ui.ts');
    const modifiedUi = [
      `// Stale-translation check hashes the normalised text between 'const en = {' and '} as const;'.`,
      `const en = {`,
      `  'brand.home': 'New Home',`,
      `} as const;`,
      ``,
      `export type UiKey = keyof typeof en;`,
      ``,
    ].join('\n');
    writeFileSync(uiPath, modifiedUi, 'utf8');

    // Verify it is stale
    const beforeFailures = findStale({ root, policy });
    assert.equal(beforeFailures.length, 3);

    // Run stampLocale
    const result = stampLocale('es', { root, policy });
    assert.ok(result.changedFiles.length >= 3);

    // Verify all stale failures are gone
    const afterFailures = findStale({ root, policy });
    assert.deepEqual(afterFailures, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('stampLocale refuses default locale and throws on unknown locale', () => {
  const root = makeStaleFixtureTree();
  try {
    assert.throws(
      () => stampLocale('en', { root, policy }),
      /default locale/i
    );
    assert.throws(
      () => stampLocale('fr', { root, policy }),
      /unknown locale/i
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
