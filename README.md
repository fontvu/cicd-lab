# 🧁 cicd-lab — the Magic Button, delivered by robots

A tiny website (one big magic button 🪄 that counts presses) with a **real
CI/CD pipeline** that checks and delivers it automatically on every push.
Built to be learned from: zero dependencies, zero paid services, every line
explained.

## 🍋 First, the lemonade-stand story (ELI5)

- Imagine you run a lemonade stand.
- Your **recipe** = your **code**.
- Every time you change the recipe, you don't hand it straight to customers. First, **robot inspectors** spell-check and taste-test it — that's **CI** (Continuous Integration).
- Only if the robots give a thumbs up does the **delivery truck** 🚚 drive the lemonade to your friends — that's **CD** (Continuous Delivery/Deployment).
- If a robot finds a mistake (you forgot the sugar 🍬), the truck **never leaves**. You fix the recipe, the robots check again, then the truck goes.
- That's all CI/CD is: robots check your work, robots deliver it, and broken stuff never reaches friends.

## 🎯 What you'll build

- A one-page site: **The Magic Button** — a big button that counts how many times you've pressed it.
- A GitHub Actions pipeline with 4 jobs: **lint → test → build → deploy**.
- Automatic publishing to **GitHub Pages** (free) on every push to `main` — and when you press the manual *Run workflow* button on `main`. Pull requests never deploy. That difference is the lesson of the gate.

## 🎤 The 5-minute kid talk (presentation.html)

There is a companion slide deck: **`presentation.html`**. It tells the same story with pictures (a robot kitchen 🍪), includes a clickable pipeline simulator where you can break the build on purpose, and a quiz. **Open it in a browser for a kid-friendly tour.** It is one self-contained file — no internet needed, works even when emailed.

## 📋 Prerequisites (5 minutes, free)

- A free GitHub account (github.com).
- Git installed (git-scm.com) — or just use GitHub's web editor for edits.
- Node.js 22 is **optional** — only for "Local Mode" below. The pipeline itself runs on GitHub's computers, not yours. (Any local Node ≥20 works; the workflow pins 22.)
- GitHub Pages on the free plan requires a **public** repository. A fork of a public repo is public by default, so forking (step 1 below) gets you that for free.

## 🚀 Quickstart (15 minutes)

1. **Fork** this repo (top-right *Fork* button) — you now own a copy.
2. **Clone** your fork, then enter its folder:
   ```
   git clone https://github.com/YOU/cicd-lab.git
   cd cicd-lab
   ```
3. **Enable Pages once**: repo *Settings → Pages → Source → "GitHub Actions"*.
4. **Make a change**: edit `index.html` (change the `<title>` or the headline).
5. **Stage, commit, push** — three separate commands, one per line:
   ```
   git add .
   git commit -m "my first change"
   git push
   ```
6. **Watch the robots**: click the *Actions* tab — four jobs run: lint, test, build, deploy. All green ✅.
7. **See it live**: open `https://YOU.github.io/cicd-lab/` — your Magic Button, delivered by robots. Press it. 🎉

> 💻 **Windows note (PowerShell):** PowerShell 5.1 (the Windows default) does not understand `&&` chains, so every command in this README is given **one per line** — run them in PowerShell, Git Bash, or cmd and they all work. If you ever see a one-liner like `a && b && c` in other docs, split it into separate lines on Windows.

## 🗺️ The pipeline at a glance

```
   you push code
        │
        ▼
   ┌──────────┐   ┌──────────┐
   │  LINT    │   │  TEST    │      ← run in PARALLEL
   │ 🔍 spell │   │ 🍪 taste │        both must be green
   │   check  │   │   test   │
   └────┬─────┘   └────┬─────┘
        └──────┬───────┘
               ▼  (needs: both passed)
        ┌──────────────┐
        │    BUILD     │   📦 pack the box → dist/
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │    DEPLOY    │   🚚 main + not-a-PR only → GitHub Pages
        └──────┬───────┘
               ▼
        friends see it 🎉
```

## 🏠 Local Mode (no GitHub needed — Node optional)

- `npm run lint` — robot spell-check (JS syntax + HTML wiring).
- `npm test` — robot taste-test (5 tests of the counter logic).
- `npm run build` — pack the box into `dist/` (adds `BUILD_INFO.json`).
- `npm start` — serve the **built** site at http://localhost:8080 (run `npm run build` first; the server prints a hint if you forget).
- Why can't I just double-click `index.html`? → see Troubleshooting.

## 🔧 How the site works (30 seconds)

- `counter.js` — pure logic (`createCounter`). No DOM. This is what tests check.
- `app.js` — glue: imports the counter and wires it to the buttons. It first checks the magic button exists, so the same file can safely be included by other pages (see exercise c).
- `index.html` + `style.css` — the page itself.
- Separating logic from the screen is WHY tests can run in Node with no browser.

## 🏋️ Exercises (doing these IS the lesson)

**(a) Break it on purpose — watch the red X (10 min)**
1. Open `test/counter.test.js`; in the first test change `assert.equal(c.value, 0)` to `assert.equal(c.value, 5)`.
2. Commit + push.
3. In the *Actions* tab watch: lint ✅ passes, test ❌ fails, and **build + deploy never run** — that's the safety net.
4. Change it back, push → all green, site re-deploys.
Lesson: red is good. The robots caught it before your friends did.

**(b) Add a new test (5 min)** — append to `test/counter.test.js`:
```js
test('increment twice from 7 gives 9', () => {
  const c = createCounter(7);
  c.increment();
  assert.equal(c.increment(), 9);
});
```
Push, watch 6 tests pass. Lesson: adding tests is easy and safe.

**(c) Add a second HTML page (15 min)**
1. Create `about.html` (copy `index.html`, change the title/text, **keep the script tag** — it is safe, see below).
2. Link it from `index.html`: `<a href="about.html">About</a>`.
3. Edit `scripts/build.js`: add `'about.html'` to the copy list.
4. Push → the build log shows `copied about.html`; visit `https://YOU.github.io/cicd-lab/about.html`.

Why is keeping the script tag safe? `app.js` is written defensively: before touching anything it checks `if (document.getElementById('magic-button')) { ... }`. `about.html` has no magic button, so `app.js` simply does nothing there instead of crashing. Without that guard, the page would throw a `TypeError` (`countEl` would be `null`) — a real bug, exactly the kind the robots love to catch. (Try deleting the guard and see for yourself.)
Lesson: the build step decides what ships — you just taught it a new file.

**(d) Open a Pull Request — notice deploy is skipped (the gate) (10 min)**
1. `git checkout -b change-title`
2. Edit the title in `index.html`, commit, `git push -u origin change-title`.
3. Open a PR in GitHub. Watch the pipeline: lint/test/build run; **deploy is skipped** (grey).
4. Merge the PR → the push to `main` triggers the pipeline again, and now deploy runs.
Lesson: PRs are "inspect my homework"; pushes to main are "publish it". The `if:` in the deploy job is the gate: deploy only when the branch is `main` **and** the event is not a pull request.

**(e) Optional: human approval gate (10 min)**
1. Repo *Settings → Environments → New environment* → name it `github-pages` → add yourself as a required reviewer.
2. In `.github/workflows/ci-cd.yml`, uncomment the `environment: github-pages` line in the deploy job. **It sits at JOB level** — the same indentation as `needs:`, `if:` and `runs-on:` — exactly where the commented line already is:
   ```yaml
   deploy:
     needs: build
     if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
     # environment: github-pages   ← uncomment THIS line (job level!)
     runs-on: ubuntu-latest
   ```
3. Push. The deploy job waits yellow ⏳ until you click *Approve* in the Actions tab.
Lesson: CD can still require a human before the truck leaves.

⚠️ **Placement warning (this breaks YAML):** `environment:` is a **job-level** key. If you uncomment it *inside* the `steps:` block — i.e. indented deeper, under a `- name:` line — you get **invalid YAML** and GitHub rejects the whole workflow file with a parse error ("did not find expected '-' indicator"). Step-level `environment` is not merely wrong, it is broken syntax. Job level or nothing.

## 🆘 Troubleshooting

- **"Why can't I double-click index.html?"** — The page uses ES modules (`<script type="module">`), and browsers block module loading from `file://` addresses (a browser security rule, not a bug). Serve it over http instead: `npm run build` then `npm start`, open http://localhost:8080. (The deployed site works because GitHub Pages serves over https.)
- **The deploy job didn't run on my PR** — correct! Deploy only runs on `main` when the event is not a pull request (the `if:` gate). Merge the PR.
- **I pressed "Run workflow" but nothing deployed** — a manual run deploys only when you start it on the `main` branch; the same gate applies. Run it on `main`.
- **Pages shows 404 right after my first deploy** — wait ~1 minute; confirm *Settings → Pages → Source* is "GitHub Actions".
- **Deploy fails with "no Pages source configured"** — do Quickstart step 3 (*Settings → Pages → Source → "GitHub Actions"*) once, then push again.
- **The Actions tab is empty** — your default branch must be named `main` (the workflow triggers on `main`). Rename `master` → `main` in repo *Settings → Branches*.
- **Pages deploy fails saying the repo must be public** — free-tier Pages works only on public repositories. Make the repo public (or use a paid plan).
- **`npm: command not found`** — Node isn't installed. Install Node 22 (nodejs.org) or skip Local Mode; GitHub's runners already have Node.
- **Tests pass locally but fail in CI** — check versions: the workflow pins Node 22; run `node --version` locally (needs ≥20).
- **"YAML error" in Actions** — indentation matters: 2 spaces, never tabs; keep `node-version: "22"` quoted; and remember `environment:` belongs at job level, never inside a step (see exercise e).

## 📖 Glossary (one line each)

- **CI (Continuous Integration)** — robots automatically check every change (lint + test) before it goes anywhere.
- **CD (Continuous Delivery/Deployment)** — robots automatically deliver the checked change (build + deploy).
- **Pipeline** — the whole assembly line: commit → lint → test → build → deploy.
- **Runner** — the fresh, throwaway computer GitHub lends you for one pipeline run.
- **Job** — one station on the line (lint, test, build, deploy).
- **Step** — one task inside a job (checkout, install Node, run a command).
- **Artifact** — the packed box (`dist/`) handed from build to deploy.
- **Environment** — a named place (like `github-pages`) that can require human approval.
- **Pages** — GitHub's free static-site hosting; serves the artifact at `https://<user>.github.io/<repo>/`.
- **OIDC** — a trust handshake letting the workflow prove "I am really this repo" so Pages deploy needs no stored secret.
- **Lint** — automated style/syntax checking ("spell check for code").
- **ESM** — ES modules, the `import`/`export` system used by all our JS.
- **Concurrency** — the rule that only one pipeline may publish at a time.

## 🧹 Done?

- Delete the fork anytime — it cost you nothing. Next steps: try exercises (c) and (e), then fork a real project and look for its `.github/workflows/`.
