// scripts/lint.js — our zero-dependency "spell check" (the LINT stage).
//
// WHAT IT DOES (two jobs):
//  1) Parses every shipped .js file with node:vm. Parsing WITHOUT running
//     catches syntax errors (a missing brace, a stray comma) safely.
//  2) Reads index.html and verifies the wiring: it must link style.css,
//     load app.js as a module, and contain the three ids app.js expects.
// WHY node:vm: it is a Node builtin — no eslint install, works on Windows.
// WHY --experimental-vm-modules (see package.json "lint" script): ESM
// syntax (import/export) needs vm.SourceTextModule, which that flag enables.
// PATHS: built with node:path (path.join) so the same code works on
// Windows (\), macOS and Linux (/) — never hand-typed "a/b" strings.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// import.meta.url gives THIS file's address; fileURLToPath turns it into a
// normal path; two dirname() calls climb from scripts/ up to the repo root.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let failures = 0;

if (typeof vm.SourceTextModule === 'undefined') {
  console.error(
    'vm.SourceTextModule is unavailable. Use "npm run lint" — ' +
    'it already passes --experimental-vm-modules.'
  );
  process.exit(1);
}

// --- Part 1: syntax-check each shipped JS file (parse only, never execute) ---
const jsFiles = ['counter.js', 'app.js', 'scripts/lint.js', 'scripts/build.js'];
for (const rel of jsFiles) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  try {
    // SourceTextModule understands ESM (import/export). Constructing it
    // compiles/parses the code — that is all we need for a syntax check.
    new vm.SourceTextModule(code, { identifier: rel });
    console.log(`✔ syntax OK: ${rel}`);
  } catch (err) {
    failures += 1;
    console.error(`✖ SYNTAX ERROR in ${rel}: ${err.message}`);
  }
}

// --- Part 2: verify index.html is wired the way app.js expects ---
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const checks = [
  ['index.html links style.css', html.includes('href="style.css"')],
  ['index.html loads app.js as an ES module',
    html.includes('type="module"') && html.includes('src="app.js"')],
  ['index.html has id="count"', html.includes('id="count"')],
  ['index.html has id="magic-button"', html.includes('id="magic-button"')],
  ['index.html has id="reset-button"', html.includes('id="reset-button"')],
];
for (const [label, ok] of checks) {
  if (ok) {
    console.log(`✔ ${label}`);
  } else {
    failures += 1;
    console.error(`✖ MISSING: ${label}`);
  }
}

if (failures > 0) {
  console.error(`\nLint FAILED with ${failures} problem(s). Fix, commit, push.`);
  process.exit(1); // non-zero exit = the CI job goes red
}
console.log('\nLint passed ✔ (all JS parses; index.html is wired correctly)');
