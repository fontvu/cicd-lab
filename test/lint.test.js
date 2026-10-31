// test/lint.test.js — testing the LINTER itself.
//
// WHY THIS FILE EXISTS: the linter is a program, and programs have bugs. If
// scripts/lint.js silently stopped catching broken HTML, the CI would stay
// green while shipping broken pages — the worst possible failure for a
// safety net. So we test the safety net.
//
// PATTERN: "integration test" — run the real tool as a subprocess and assert
// on its EXIT CODE and output. Two rules make this work:
//   1) A non-zero exit code is what turns CI red. That is the contract.
//   2) Work on a COPY in a temp directory, never on the real repo — the
//      test deliberately breaks files, and it must not break your checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Copy the repo (minus .git/dist/node_modules) into a throwaway folder and
// return its path. Every destructive test works on that copy.
function makeSandbox() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cicd-lab-lint-'));
  fs.cpSync(root, tmp, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(root, src);
      if (rel === '') return true;
      const top = rel.split(path.sep)[0];
      return !['.git', 'dist', 'node_modules'].includes(top);
    },
  });
  return tmp;
}

// Run the linter inside a directory and capture what the CI would see.
function runLint(dir) {
  return spawnSync(
    process.execPath,
    ['--experimental-vm-modules', path.join(dir, 'scripts', 'lint.js')],
    { cwd: dir, encoding: 'utf8' }
  );
}

test('lint passes on a healthy repository (exit code 0)', () => {
  const result = runLint(root);
  assert.equal(result.status, 0, `lint should pass:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Lint passed/);
});

test('lint FAILS (exit code 1) when the HTML wiring is broken', () => {
  const sandbox = makeSandbox();
  try {
    const file = path.join(sandbox, 'index.html');
    const broken = fs.readFileSync(file, 'utf8').replace('id="count"', 'id="counter-value"');
    fs.writeFileSync(file, broken);

    const result = runLint(sandbox);
    assert.equal(result.status, 1, 'a broken id must fail the lint job');
    assert.match(result.stderr, /id="count"/, 'the failure must name the missing id');
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('lint FAILS (exit code 1) when a secret is committed', () => {
  const sandbox = makeSandbox();
  try {
    // A fake token that MATCHES the pattern (prefix + 36 random chars).
    // It grants no access to anything — it only has to look like a secret.
    fs.writeFileSync(
      path.join(sandbox, 'config.js'),
      'export const token = "ghp_' + 'A1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvWxYz0123";\n'
    );

    const result = runLint(sandbox);
    assert.equal(result.status, 1, 'a committed secret must fail the lint job');
    assert.match(result.stderr, /secret|GitHub/i);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});
