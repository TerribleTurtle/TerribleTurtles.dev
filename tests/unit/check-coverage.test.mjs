// Unit tests for the page coverage check (scripts/check-coverage.mjs). Written first (TDD).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPolicy } from '../../scripts/lib/policy.mjs';
import { checkCoverage, discoverSourcePages } from '../../scripts/check-coverage.mjs';
import { makePassingTree, makePassingCoverageDist, writeTreeFile } from './helpers/fixture-coverage.mjs';

const policy = loadPolicy();
const CLI = fileURLToPath(new URL('../../scripts/check-coverage.mjs', import.meta.url));

/** @typedef {import('../../scripts/lib/policy.mjs').Policy} Policy */

/**
 * @param {(root: string) => void} mutate
 * @returns {string[]}
 */
function checkSourceWith(mutate) {
  const root = makePassingTree(policy);
  try {
    mutate(root);
    return checkCoverage({ root, policy });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/**
 * @param {(root: string, dist: string) => void} mutate
 * @returns {string[]}
 */
function checkDistWith(mutate) {
  const root = makePassingTree(policy);
  const dist = makePassingCoverageDist(policy);
  try {
    mutate(root, dist);
    return checkCoverage({ root, policy, distDir: dist });
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(dist, { recursive: true, force: true });
  }
}

test('checkCoverage passes with zero failures on a compliant tree', () => {
  const failures = checkSourceWith(() => {});
  assert.deepEqual(failures, []);
});

test('checkCoverage passes with zero failures on a compliant tree + dist', () => {
  const failures = checkDistWith(() => {});
  assert.deepEqual(failures, []);
});

test('checkCoverage fails when a source page is missing from policy.pages.expanded', () => {
  const failures = checkSourceWith((root) => {
    writeTreeFile(root, 'src/pages/extra.astro', '<p>Extra</p>');
  });
  assert.ok(failures.some((f) => f.includes('/extra/')), `expected failure mentioning /extra/, got ${JSON.stringify(failures)}`);
});

test('checkCoverage fails when an expanded page has no source in src/pages', () => {
  const failures = checkSourceWith((root) => {
    unlinkSync(join(root, 'src/pages/about.astro'));
  });
  assert.ok(failures.some((f) => f.includes('/about/')), `expected failure mentioning /about/, got ${JSON.stringify(failures)}`);
});

test('checkCoverage fails when a project content id has no kind:project entry in policy', () => {
  const failures = checkSourceWith((root) => {
    writeTreeFile(root, 'src/content/projects/unknown-proj.md', 'title: test');
    writeTreeFile(root, 'public/og/unknown-proj.png', 'x');
  });
  assert.ok(failures.some((f) => f.includes('unknown-proj')), `expected failure mentioning unknown-proj, got ${JSON.stringify(failures)}`);
});

test('checkCoverage fails when a policy project has no content file in src/content/projects', () => {
  const failures = checkSourceWith((root) => {
    unlinkSync(join(root, 'src/content/projects/spellcastersdb.md'));
  });
  assert.ok(failures.some((f) => f.includes('spellcastersdb')), `expected failure mentioning spellcastersdb, got ${JSON.stringify(failures)}`);
});

test('checkCoverage fails when public/og/<id>.png is missing', () => {
  const failures = checkSourceWith((root) => {
    unlinkSync(join(root, 'public/og/spellcastersdb.png'));
  });
  assert.ok(failures.some((f) => f.includes('spellcastersdb') && f.includes('og')), `expected failure mentioning og/spellcastersdb, got ${JSON.stringify(failures)}`);
});

test('checkCoverage fails when a content file declares screenshot: but .jpg is missing', () => {
  const failures = checkSourceWith((root) => {
    unlinkSync(join(root, 'public/images/work/spellcastersdb.jpg'));
  });
  assert.ok(failures.some((f) => f.includes('spellcastersdb') && f.includes('.jpg')), `expected failure mentioning .jpg, got ${JSON.stringify(failures)}`);
});

test('checkCoverage fails when a content file declares screenshot: but .webp is missing', () => {
  const failures = checkSourceWith((root) => {
    unlinkSync(join(root, 'public/images/work/spellcastersdb.webp'));
  });
  assert.ok(failures.some((f) => f.includes('spellcastersdb') && f.includes('.webp')), `expected failure mentioning .webp, got ${JSON.stringify(failures)}`);
});

test('checkCoverage fails when TODO(scaffold) marker is present in src/ or security/', () => {
  const failures = checkSourceWith((root) => {
    writeTreeFile(root, 'src/pages/about.astro', '<p>TODO(scaffold)</p>');
  });
  assert.ok(failures.some((f) => f.includes('TODO(scaffold)')), `expected failure mentioning TODO(scaffold), got ${JSON.stringify(failures)}`);
});

test('discoverSourcePages ignores 404.astro and non-.astro files', () => {
  const root = makePassingTree(policy);
  try {
    const pages = discoverSourcePages(root, policy);
    assert.ok(!pages.some((p) => p.path === '/404/' || p.basePath === '/404/'), '404.astro should not be discovered');
    assert.ok(!pages.some((p) => p.path.includes('llms.txt')), 'llms.txt.ts should not be discovered');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('discoverSourcePages handles non-default locale pages under src/pages/<locale>/', () => {
  const root = makePassingTree(policy);
  try {
    /** @type {Policy} */
    const multiPolicy = {
      ...policy,
      pages: {
        ...policy.pages,
        locales: ['en', 'es'],
      },
    };
    writeTreeFile(root, 'src/pages/es/about.astro', '<p>Acerca de</p>');
    const pages = discoverSourcePages(root, multiPolicy);
    const esAbout = pages.find((p) => p.path === '/es/about/');
    assert.ok(esAbout, 'should find /es/about/');
    assert.equal(esAbout?.locale, 'es');
    assert.equal(esAbout?.basePath, '/about/');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('discoverSourcePages expands [locale] dynamic routes across non-default locales', () => {
  const root = makePassingTree(policy);
  try {
    /** @type {Policy} */
    const multiPolicy = {
      ...policy,
      pages: {
        ...policy.pages,
        locales: ['en', 'es'],
      },
    };
    const pages = discoverSourcePages(root, multiPolicy);
    const esAbout = pages.find((p) => p.path === '/es/about/');
    assert.ok(esAbout, 'should find /es/about/ from [locale]/about.astro');
    assert.equal(esAbout?.locale, 'es');
    assert.equal(esAbout?.basePath, '/about/');

    const esHome = pages.find((p) => p.path === '/es/');
    assert.ok(esHome, 'should find /es/ from [locale]/index.astro');

    const esProject = pages.find((p) => p.path === '/es/work/spellcastersdb/');
    assert.ok(esProject, 'should find /es/work/spellcastersdb/ from [locale]/work/[slug].astro');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkCoverage fails when a content prose page in src/content/pages/<locale>/<slug>.md is missing', () => {
  const failures = checkSourceWith((root) => {
    unlinkSync(join(root, 'src', 'content', 'pages', 'en', 'about.md'));
  });
  assert.ok(
    failures.some((f) => f.includes('about') && f.includes('content/pages')),
    `expected failure mentioning missing content page, got ${JSON.stringify(failures)}`,
  );
});

test('checkCoverage fails when a project i18n translation is missing for a non-default locale', () => {
  /** @type {Policy} */
  const multiPolicy = {
    ...policy,
    pages: {
      ...policy.pages,
      locales: ['en', 'es'],
    },
  };
  const root = makePassingTree(multiPolicy);
  try {
    unlinkSync(join(root, 'src', 'content', 'projects-i18n', 'es', 'spellcastersdb.md'));
    const failures = checkCoverage({ root, policy: multiPolicy });
    assert.ok(
      failures.some((f) => f.includes('spellcastersdb') && f.includes('projects-i18n')),
      `expected failure mentioning missing project i18n file, got ${JSON.stringify(failures)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkCoverage with dist fails when 404.html is missing from dist root', () => {
  const failures = checkDistWith((_root, dist) => {
    unlinkSync(join(dist, '404.html'));
  });
  assert.ok(failures.some((f) => f.includes('404.html')), `expected failure mentioning 404.html, got ${JSON.stringify(failures)}`);
});

test('checkCoverage with dist fails when an expanded page is missing from dist', () => {
  const failures = checkDistWith((_root, dist) => {
    unlinkSync(join(dist, 'about/index.html'));
  });
  assert.ok(failures.some((f) => f.includes('/about/')), `expected failure mentioning /about/, got ${JSON.stringify(failures)}`);
});

test('checkCoverage with dist fails when dist contains an unexpected page', () => {
  const failures = checkDistWith((_root, dist) => {
    writeTreeFile(dist, 'surprise/index.html', '<p>boo</p>');
  });
  assert.ok(failures.some((f) => f.includes('/surprise/')), `expected failure mentioning /surprise/, got ${JSON.stringify(failures)}`);
});

test('checkCoverage CLI exits 0 on passing tree and 1 on failing tree', () => {
  const root = makePassingTree(policy);
  const dist = makePassingCoverageDist(policy);
  try {
    const ok = spawnSync(process.execPath, [CLI, '--root', root, '--dist', dist], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /PASS/);

    // Make it fail by adding an uncovered source page
    writeTreeFile(root, 'src/pages/uncovered.astro', '<p>uncovered</p>');
    const bad = spawnSync(process.execPath, [CLI, '--root', root, '--dist', dist], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /FAIL/);
    assert.match(bad.stderr, /\/uncovered\//);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(dist, { recursive: true, force: true });
  }
});
