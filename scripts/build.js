// scripts/build.js — our zero-dependency "pack the box" (the BUILD stage).
//
// WHAT IT DOES:
//  1) Wipes dist/ (never ship stale files from an older build).
//  2) Copies the site files into dist/ — this folder IS the box.
//     presentation.html is included on purpose: the slide deck ships WITH
//     the site, so its live URL (/presentation.html) works after deploy and
//     not just when you double-click the file on your own laptop.
//  3) Writes dist/BUILD_INFO.json: a label on the box with the version
//     (from package.json), a timestamp, and the commit sha
//     (GITHUB_SHA env var on Actions, 'local' on your machine).
// WHY Node: fs/path behave identically on Windows, macOS, Linux.
// PATHS: node:path joins handle each OS's separators — portable by design.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Climb from scripts/ up to the repo root, wherever this machine lives.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// 1) clean
fs.rmSync(dist, { recursive: true, force: true }); // force: no error if absent
fs.mkdirSync(dist, { recursive: true });

// 2) pack the box
for (const file of ['index.html', 'style.css', 'app.js', 'counter.js', 'presentation.html']) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
  console.log(`copied ${file} -> dist/${file}`);
}

// 3) label the box
const buildInfo = {
  version: pkg.version,
  builtAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || 'local',
};
fs.writeFileSync(
  path.join(dist, 'BUILD_INFO.json'),
  JSON.stringify(buildInfo, null, 2) + '\n'
);
console.log(
  `wrote dist/BUILD_INFO.json (v${buildInfo.version} @ ${String(buildInfo.commit).slice(0, 7)})`
);
console.log('\nBuild passed ✔ — the box (dist/) is ready to ship.');
