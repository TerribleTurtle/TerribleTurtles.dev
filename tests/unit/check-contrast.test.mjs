// @ts-check
/**
 * Proves the contrast gate is not vacuous: it must exit 1 on a failing palette
 * and exit 0 on the real tokens file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = 'scripts/check-contrast.mjs';
const grey = 'light-dark(oklch(60% 0 0), oklch(60% 0 0))';
const failingTokens = `:root {
  --color-bg: light-dark(oklch(97% 0.01 85), oklch(17% 0.012 160));
  --color-surface: light-dark(oklch(94% 0.014 85), oklch(21% 0.014 160));
  --color-text: ${grey};
  --color-text-muted: ${grey};
  --color-accent: ${grey};
  --color-hairline: ${grey};
}`;

test('check-contrast exits 1 when a pair is below the minimum', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tt-contrast-'));
  try {
    const file = join(dir, 'tokens.css');
    writeFileSync(file, failingTokens);
    const run = spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stdout, /FAIL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('check-contrast exits 0 on the real tokens file', () => {
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});
