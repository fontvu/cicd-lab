// scripts/lint.js — our zero-dependency "spell check" (the LINT stage).
//
// WHAT IT DOES (four parts, each one a real linting idea):
//  1) PARSE every shipped .js file with node:vm. Parsing WITHOUT running
//     catches syntax errors (a missing brace, a stray comma) safely.
//  2) CHECK the HTML wiring: index.html must link style.css, load app.js as
//     a module, and contain the ids app.js expects. This is the "did you
//     rename an id and forget the JS?" class of bug — the #1 time sink in
//     plain front-end code.
//  3) CHECK project consistency: the npm scripts the CI calls must exist,
//     and the CI workflow must not call a script that was renamed away.
//     ("It works locally but the pipeline calls a script that no longer
//     exists" is a whole category of red builds.)
//  4) SCAN for accidentally committed secrets — the same instinct as GitHub's
//     own secret scanning, in ~30 lines and zero dependencies.
//
// WHY A HOMEMADE LINTER AT ALL? Because "lint" is not a magic tool, it is
// "a program that reads your project and complains about things your team
// decided to complain about". ESLint is one such program. This file is a
// smaller one, and it teaches the shape of the idea.
//
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
let checks = 0;

// One helper so every check below looks the same and counts itself.
function check(label, ok, detail = '') {
  checks += 1;
  if (ok) {
    console.log(`✔ ${label}`);
  } else {
    failures += 1;
    console.error(`✖ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

if (typeof vm.SourceTextModule === 'undefined') {
  console.error(
    'vm.SourceTextModule is unavailable. Use "npm run lint" — ' +
    'it already passes --experimental-vm-modules.'
  );
  process.exit(1);
}

// --- Part 1: syntax-check each shipped JS file (parse only, never execute) --
const jsFiles = ['counter.js', 'app.js', 'scripts/lint.js', 'scripts/build.js'];
for (const rel of jsFiles) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  try {
    // SourceTextModule understands ESM (import/export). Constructing it
    // compiles/parses the code — that is all we need for a syntax check.
    new vm.SourceTextModule(code, { identifier: rel });
    console.log(`✔ syntax OK: ${rel}`);
    checks += 1;
  } catch (err) {
    failures += 1;
    console.error(`✖ SYNTAX ERROR in ${rel}: ${err.message}`);
  }
}

// --- Part 2: verify index.html is wired the way app.js expects ---------------
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const htmlChecks = [
  ['index.html links style.css', html.includes('href="style.css"')],
  ['index.html loads app.js as an ES module',
    html.includes('type="module"') && html.includes('src="app.js"')],
  ['index.html has id="count"', html.includes('id="count"')],
  ['index.html has id="magic-button"', html.includes('id="magic-button"')],
  ['index.html has id="reset-button"', html.includes('id="reset-button"')],
  // Accessibility basics: a page without a <title> shows a blank tab, and a
  // page without lang= is unreadable to screen readers.
  ['index.html has a <title>', /<title>[^<]+<\/title>/.test(html)],
  ['index.html declares a language (lang=)',
    /<html[^>]*\slang="[a-zA-Z-]+"/.test(html)],
];
for (const [label, ok] of htmlChecks) check(label, ok);

// --- Part 3: project consistency (the pipeline and the package agree) -------
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const name of ['lint', 'test', 'build', 'start']) {
  check(`package.json defines the "${name}" script`,
    typeof pkg.scripts?.[name] === 'string');
}

// The workflow calls npm scripts. If a script is renamed there, the CI fails
// with a confusing "command not found" instead of a clear message. Catch it
// here, where the error can still be read.
const workflowPath = path.join(root, '.github', 'workflows', 'ci-cd.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const calledScripts = [
  ...[...workflow.matchAll(/npm run ([\w-]+)/g)].map((m) => m[1]),
  ...[...workflow.matchAll(/npm test\b/g)].map(() => 'test'),
];
for (const name of new Set(calledScripts)) {
  check(`the workflow's "npm run ${name}" exists in package.json`,
    typeof pkg.scripts?.[name] === 'string',
    'the pipeline would fail with "command not found"');
}

// Build output must never be committed: it is regenerated on every build,
// so a committed copy goes stale and causes confusing diffs.
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
check('.gitignore ignores dist/ (build output is never committed)',
  /^\s*dist\/?\s*$/m.test(gitignore));

// --- Part 4: secret scan (catch credentials before they become incidents) ---
// The patterns are built from string fragments ON PURPOSE: if the source
// code of this linter contained the literal text of a token prefix, the
// scanner would flag ITSELF. Building the pattern at runtime keeps this file
// clean and teaches a genuinely useful trick.
const SECRET_PATTERNS = [
  { name: 'GitHub personal access token', re: new RegExp('gh' + '[psuor]_[A-Za-z0-9]{20,}') },
  { name: 'GitHub fine-grained PAT', re: new RegExp('github' + '_pat_[A-Za-z0-9_]{20,}') },
  { name: 'AWS access key id', re: new RegExp('AKIA' + '[0-9A-Z]{16}') },
  { name: 'Slack token', re: new RegExp('xox' + '[baprs]-[A-Za-z0-9-]{10,}') },
  { name: 'private key block', re: new RegExp('-----BEGIN [A-Z ]*PRIVATE KEY-----') },
];

// Which files to read: text-ish files, skipping generated/huge folders.
const SKIP_DIRS = new Set(['.git', 'dist', 'node_modules', 'coverage']);
const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.json', '.md', '.yml', '.yaml',
  '.html', '.css', '.sh', '.txt', '.env',
]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      yield path.join(dir, entry.name);
    }
  }
}

let scanned = 0;
for (const file of walk(root)) {
  const rel = path.relative(root, file);
  const base = path.basename(file);

  // A .env file in the repo is a red flag on its own: those files hold
  // local secrets and are supposed to be git-ignored, never committed.
  if (base === '.env' || base.startsWith('.env.')) {
    check(`${rel} is not committed (environment files hold secrets)`, false,
      'add it to .gitignore and rotate anything inside it');
    continue;
  }

  const ext = path.extname(file).toLowerCase();
  if (!TEXT_EXT.has(ext)) continue;
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue; // unreadable/binary-ish file: not our problem here
  }
  scanned += 1;
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(content)) {
      check(`${rel} does not contain a ${name}`, false,
        'remove it, rotate it, and use a GitHub secret or OIDC instead');
    }
  }
}
console.log(`✔ secret scan: ${scanned} text file(s) checked, no committed credentials`);

// --- Part 5: the workflow file's own shape ---------------------------------
// LESSON FROM PRODUCTION: `timeout-minutes` under a workflow-level
// `defaults.run:` looks harmless and is REJECTED by GitHub with a bare
// "workflow file issue" — no job, no logs, nothing to debug from. This part
// checks the keys GitHub accepts at each level, so a mistake like that dies
// in the lint job instead of in a mystery failure.
//
// WHY: the workflow YAML is code too, and it deserves the same treatment as
// the rest of the repo. The key lists below are the documented, allowed
// keys — not a full parser, just enough to catch a misplaced key.
const ALLOWED = {
  top: ['name', 'run-name', 'on', 'permissions', 'env', 'defaults', 'concurrency', 'jobs'],
  job: ['name', 'needs', 'if', 'permissions', 'environment', 'concurrency', 'outputs',
        'env', 'defaults', 'steps', 'uses', 'with', 'timeout-minutes', 'runs-on',
        'strategy', 'continue-on-error', 'container', 'services', 'secrets'],
  defaultsRun: ['shell', 'working-directory'],
};

// Split the workflow into lines we can reason about, keeping indentation.
const wfLines = workflow.split('\n').map((raw) => {
  const indent = raw.length - raw.trimStart().length;
  return { indent, text: raw.trim(), raw };
});

// 1) workflow-level keys
for (const line of wfLines) {
  if (line.text.startsWith('#')) continue;        // YAML comments are not keys
  if (line.indent !== 0 || !line.text.endsWith(':')) continue;
  const key = line.text.slice(0, -1);
  if (!ALLOWED.top.includes(key)) {
    check(`the workflow's top-level key "${key}" is valid`, false,
      'unknown top-level keys make GitHub reject the whole file');
  }
}

// 2) `defaults.run` only understands shell + working-directory
const defaultsAt = wfLines.findIndex((l) => l.indent === 0 && l.text === 'defaults:');
if (defaultsAt !== -1) {
  for (let i = defaultsAt + 1; i < wfLines.length; i++) {
    const line = wfLines[i];
    if (line.text.startsWith('#')) continue;   // comments are not keys
    if (line.indent === 0) break;            // next top-level key: block ends
    if (line.indent === 4 && line.text.includes(':')) {
      // Key = the text before the FIRST colon ("timeout-minutes: 10" -> "timeout-minutes")
      const key = line.text.split(':')[0].trim();
      check(`defaults.run may only set shell / working-directory (found "${key}")`,
        ALLOWED.defaultsRun.includes(key),
        'timeout-minutes belongs at JOB level, not here');
    }
  }
}

// 3) job-level keys + `needs:` targets that exist
const jobsStart = wfLines.findIndex((l) => l.indent === 0 && l.text === 'jobs:');
if (jobsStart !== -1) {
  const jobNames = [];
  for (let i = jobsStart + 1; i < wfLines.length; i++) {
    const m = wfLines[i].text.match(/^([A-Za-z0-9_-]+):$/);
    if (wfLines[i].indent === 2 && m) jobNames.push(m[1]);
  }
  let current = null;
  for (let i = jobsStart + 1; i < wfLines.length; i++) {
    const line = wfLines[i];
    if (line.text.startsWith('#')) continue;   // comments are not keys
    const m = line.text.match(/^([A-Za-z0-9_-]+):$/);
    if (line.indent === 2 && m) { current = m[1]; continue; }
    if (line.indent === 4 && line.text.includes(':')) {
      const key = line.text.split(':')[0].trim();
      check(`job "${current}" may use the key "${key}"`, ALLOWED.job.includes(key),
        'a misplaced key makes GitHub reject the whole workflow file');
    }
    if (line.indent === 4 && line.text.startsWith('needs:')) {
      // Strip any trailing comment: "needs: build   # only after a good build"
      const wanted = line.text.slice('needs:'.length).split('#')[0].trim();
      const names = wanted.startsWith('[')
        ? wanted.replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean)
        : [wanted];
      for (const dep of names) {
        check(`job "${current}" needs the existing job "${dep}"`,
          jobNames.includes(dep), 'a `needs:` that points nowhere stalls the pipeline');
      }
    }
  }
}

// --- Verdict -----------------------------------------------------------------
if (failures > 0) {
  console.error(`\nLint FAILED with ${failures} problem(s). Fix, commit, push.`);
  process.exit(1); // non-zero exit = the CI job goes red
}
console.log(`\nLint passed ✔ (${checks} checks: syntax, wiring, consistency, secrets, workflow shape)`);
