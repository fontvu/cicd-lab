# 🧁 cicd-lab — the Magic Button, delivered by robots

A tiny website (one big magic button 🪄 that counts presses) with a **real
CI/CD pipeline** that checks and delivers it automatically on every push.
Built to be learned from: zero dependencies, zero paid services, every line
explained.

> **Audience:** a developer in their first job, or a career changer. The
> vocabulary here is the vocabulary you will hear in a real team review
> (pipeline, matrix, artifact, environment, gate, smoke test) — but every
> concept is explained from scratch, and the working lab is small enough to
> read in one sitting.

## 🍋 First, the lemonade-stand story (ELI5)

- Imagine you run a lemonade stand.
- Your **recipe** = your **code**.
- Every time you change the recipe, you don't hand it straight to customers. First, **robot inspectors** spell-check and taste-test it — that's **CI** (Continuous Integration).
- Only if the robots give a thumbs up does the **delivery truck** 🚚 drive the lemonade to your friends — that's **CD** (Continuous Delivery/Deployment).
- If a robot finds a mistake (you forgot the sugar 🍬), the truck **never leaves**. You fix the recipe, the robots check again, then the truck goes.
- That's all CI/CD is: robots check your work, robots deliver it, and broken stuff never reaches friends.

## 🏢 The same thing in workplace language

| Kid version | Workplace version | Where it lives in this repo |
|---|---|---|
| Robot inspectors check the recipe | **CI**: every change is automatically verified before it merges | `lint` + `test` jobs |
| The delivery truck | **CD**: verified changes are published automatically | `build` → `deploy` jobs |
| "Only from the main road" | **Release gate**: deploy only from a protected branch, never from a PR | the `if:` line in the `deploy` job |
| The recipe card gets checked for typos | **Linting**: static rules that catch mistakes a compiler cannot | `scripts/lint.js` (50 checks) |
| The taste test | **Automated tests**: a checklist that must pass for the change to be allowed | `test/` (12 tests) |
| The packed box | **Artifact**: an immutable, versioned build output | `dist/` + `BUILD_INFO.json` |
| "Did the parcel actually arrive?" | **Smoke test**: verify the live thing after deploying it | the `smoke` job |
| The head chef signing the order | **Environment protection rules**: a human approves production releases | `environment: production` |

**Which flavour of CD is this?** Our pipeline deploys *automatically* once
`main` is green — that is **continuous deployment**. Add a required reviewer
to the `production` environment (exercise e) and it becomes **continuous
delivery**: the code is always *ready* to ship, but a human gives the final
nod. Both are normal; the choice is a risk decision, not a technical one.

## 🎯 What you'll build

- A one-page site: **The Magic Button** — a big button that counts how many times you've pressed it.
- A GitHub Actions pipeline with 5 jobs: **lint → test (on Node 20 *and* 22) → build → deploy → smoke**.
- Automatic publishing to **GitHub Pages** (free) on every push to `main` — and when you press the manual *Run workflow* button on `main`. Pull requests never deploy. That difference is the lesson of the gate.
- A **post-deploy smoke test** that fetches the live site and proves it was built from *this* commit.

## 🎤 The talk (presentation.html)

There is a companion slide deck: **`presentation.html`** — 23 slides, a
clickable pipeline simulator where you break the build on purpose, a
failure-triage walkthrough, and a quiz. **Open it in a browser for the
guided tour.** It is one self-contained file — no internet needed, works even
when emailed. And because `npm run build` copies it into `dist/`, the deck
also goes live with the site: `https://<your-username>.github.io/cicd-lab/presentation.html` (this repo's own copy: <https://fontvu.github.io/cicd-lab/presentation.html>).

## 📋 Prerequisites (5 minutes, free)

- A free GitHub account (github.com).
- Git installed (git-scm.com) — or just use GitHub's web editor for edits.
- Node.js 22 is **optional** — only for "Local Mode" below. The pipeline itself runs on GitHub's computers, not yours. (Any local Node ≥20 works; the workflow tests 20 and 22.)
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
6. **Watch the robots**: click the *Actions* tab — five jobs run: lint, test (twice — Node 20 and Node 22), build, deploy, smoke. All green ✅.
7. **See it live**: open `https://YOU.github.io/cicd-lab/` — your Magic Button, delivered by robots. Press it. 🎉

> 💻 **Windows note (PowerShell):** PowerShell 5.1 (the Windows default) does not understand `&&` chains, so every command in this README is given **one per line** — run them in PowerShell, Git Bash, or cmd and they all work. If you ever see a one-liner like `a && b && c` in other docs, split it into separate lines on Windows.

## 🗺️ The pipeline at a glance

```
   you push code
        │
        ▼
   ┌──────────┐   ┌──────────┐
   │  LINT    │   │   TEST   │      ← run in PARALLEL
   │ 🔍 spell │   │ 🍪 taste │        test runs TWICE:
   │   check  │   │   test   │        Node 20 + Node 22
   └────┬─────┘   └────┬─────┘        (a "matrix")
        └──────┬───────┘
               ▼  (needs: both passed)
        ┌──────────────┐
        │    BUILD     │   📦 pack the box → dist/ → artifact
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │    DEPLOY    │   🚚 main + not-a-PR only → GitHub Pages
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │    SMOKE     │   🌐 fetch the LIVE site; prove it works
        └──────┬───────┘
               ▼
        friends see it 🎉
```

Reading the graph: `lint` and `test` have no `needs:`, so they run at the
same time. `build` has `needs: [lint, test]`, so it starts only when both
have passed — and if either failed, `build` is **skipped**, not failed. That
skip is a feature: it means the log tells you exactly where the chain broke.

## 🏠 Local Mode (no GitHub needed — Node optional)

- `npm run lint` — robot spell-check (50 checks: syntax, HTML wiring, project consistency, secret scan, workflow shape).
- `npm test` — robot taste-test (12 tests: 8 unit tests for the counter + 4 integration tests for the linter itself).
- `npm run build` — pack the box into `dist/` (adds `BUILD_INFO.json`).
- `npm start` — serve the **built** site at http://localhost:8080 (run `npm run build` first; the server prints a hint if you forget).
- Why can't I just double-click `index.html`? → see Troubleshooting.

## 🔧 How the site works (30 seconds)

- `counter.js` — pure logic (`createCounter`). No DOM. This is what tests check.
- `app.js` — glue: imports the counter and wires it to the buttons. It first checks the magic button exists, so the same file can safely be included by other pages (see exercise c).
- `index.html` + `style.css` — the page itself.
- Separating logic from the screen is WHY tests can run in Node with no browser.

## 🏢 How this fits into a real team's day

This is the part that trips up new developers: a pipeline is not just YAML,
it is a **team agreement** encoded in YAML.

**The flow in a real repo (this is what you will be asked to do at work):**

1. **Branch.** Never work on `main`. `git checkout -b feature/xyz`.
2. **Push the branch.** CI runs on the branch *and* on the PR. Fast feedback.
3. **Open a Pull Request.** Now you are asking a human: "please review this".
4. **Review.** A teammate reads the diff. Code review is a *human* gate; CI is a *machine* gate. Neither replaces the other.
5. **Required status checks.** The repo is configured so that `main` cannot be updated unless `lint`, `test`, `build` are green — see *Protect `main`* below. This is what stops someone merging red code.
6. **Merge.** Now `main` moves, and the pipeline runs again: build → deploy → smoke.
7. **Watch the smoke job.** If it goes red, the site is live but broken — roll back (see the runbook).

**Protect `main` (do this once on your fork, it is what a real team does):**
*Settings → Branches → Add rule → branch name `main`*
- ☑ Require branches to be up to date before merging
- ☑ Require status checks to pass → tick `lint`, `test`, `build`
- ☑ Require pull requests before merging (optional but normal)

Now try to merge a red PR: GitHub refuses, with a link to the failing check.
That is **branch protection** — the config half of the gate.

**Who does what (roles you will hear about):**
- **Author** — writes the change, pushes the branch, fixes red CI.
- **Reviewer** — approves the diff. They do not fix your code for you.
- **Release owner / on-call** — the person who would fix production if a deploy breaks. In big teams, the person who clicks "Approve" on the production environment.
- **Platform team** — owns the pipeline YAML itself. If *every* repo has the same 200-line workflow, they extract it into a reusable action (`.github/actions/...`) or a template repo.

## 🧪 What our tests cover — and what they don't

Knowing the limits of your tests is a senior skill. Ours:

| Layer | What it means | Here? |
|---|---|---|
| **Unit** | one function, no I/O, milliseconds | ✅ 8 tests on `createCounter` |
| **Integration** | your code + another real piece (here: the linter as a subprocess) | ✅ 4 tests on `scripts/lint.js` |
| **End-to-end (E2E)** | a real browser clicks the real page | ❌ not here — that needs Playwright, a dependency, and more runner minutes |
| **Contract** | "does the API still match what callers expect?" | ❌ not here |
| **Coverage** | "what % of lines did we execute?" | ❌ not here (a % is a hint, not a goal) |
| **Mutation testing** | "do the tests fail when I break the code?" | ❌ not here — but exercise (a) is a manual version of it |

Two rules a working team lives by:
- **A test that cannot fail is worse than no test.** That is why we test the linter: if it silently stopped catching broken HTML, the whole safety net would be decorative.
- **Flaky tests are a bug, not bad luck.** A test that fails 1 run in 20 ("flaky") trains the team to ignore red — which is the exact opposite of what CI is for. Fix it or delete it; never "retry until green" without a reason.

## 🚨 Triage playbook: when CI is red

Do this in order — it is the same order a senior engineer uses.

1. **Read the failing step, not the whole log.** GitHub marks the failing step in red. The line above the error is usually the cause.
2. **Reproduce locally.** `npm run lint` / `npm test` / `npm run build` — same command, same machine shape (Node 20 vs 22!). If it passes locally, check the Node version first; that is the #1 "works on my machine" cause.
3. **Check WHICH matrix leg failed.** `test (node 20)` vs `test (node 22)`. A matrix failure is often version-specific, not logic-specific.
4. **Ask "is this my code or the pipeline?"** If `lint` fails on a file you did not touch, something else changed (a renamed script, a new dependency).
5. **Do not weaken the test to make it green.** Changing an assertion to match the bug is how a bug becomes permanent. If the test is wrong, fix the test *and* say so in the PR.
6. **Push a fix; never force-push to `main`.** Force-pushing rewrites history that others may have based work on.
7. **If it is not your code and not your change**, say so in the PR and tag the owner. Silence is what turns a red build into a blocked release.

## ⏪ Rollback runbook (the deploy went out, the site is broken)

The single most useful thing to know: **a rollback is a normal operation, not
an emergency procedure.**

Our pipeline deploys on every push to `main`, so the fastest safe rollback is:

```
git log --oneline -5              # find the last good commit
git revert <bad-commit>           # new commit that undoes it (keeps history!)
git push                          # pipeline redeploys the previous state
```

- Use `git revert`, never `git reset --hard` + force-push: revert is a
  *forward* change, so everyone else's branches stay valid.
- The `smoke` job tells you whether the redeploy worked: it compares the
  live `BUILD_INFO.json` commit with the current commit.
- Real systems add more: blue/green deploys (keep the old version warm,
  flip traffic), feature flags (ship the code dark, turn it on later), and
  database migrations that are backwards-compatible for one release. This
  lab does none of that — but that is exactly what "your first on-call
  incident" is made of.

## 🔐 Security practices that actually matter

1. **Least privilege.** Our workflow requests `contents: read` by default and
   gives `pages: write` + `id-token: write` **only to the deploy job**. A
   compromised lint step cannot publish.
2. **No long-lived secrets.** The Pages deploy authenticates with **OIDC** —
   a short-lived token that proves "I am this repo's workflow". Nothing to
   store, nothing to leak, nothing to rotate. If you ever add a secret, use
   *Settings → Secrets → Actions* (encrypted, masked in logs) and never
   commit a `.env` file. Our linter fails the build if one appears.
3. **Beware of untrusted code.** A `pull_request` from a fork runs the fork's
   code on a runner. That is why the deploy job's `if:` excludes pull
   requests — and why you must never use `pull_request_target` to run a
   fork's code with a write-scoped token. That combination is a real,
   exploited vulnerability class.
4. **Pin your actions.** We use `actions/checkout@v4` for readability; a
   hardened team pins the full commit SHA (`@8f4b7f8...`) so a compromised
   action tag cannot be swapped under you. Know the trade-off: tags are
   readable, SHAs are safe.
5. **Secrets do not belong in git history.** Deleting a file does not delete
   it from history — assume anything committed is leaked and rotate it.

## 💸 Cost, quotas and caching

- **Public repositories get free GitHub-hosted runners.** Private repos get a
  monthly allowance of minutes (free tier, per plan) — a heavy matrix on a
  private repo can burn them.
- **Minutes are consumed by wall-clock time**, so a job that hangs for 10
  minutes costs 10 minutes. That is why every job here sets
  `timeout-minutes: 10` — a cheap insurance policy against a hung network
  call.
- **Caching** (`actions/cache`, or `cache:` in `setup-node`) reuses
  downloaded dependencies between runs. Our lab has **zero dependencies**,
  so there is nothing to cache — which is also why it installs instantly on
  every runner. Cache only what is expensive to recreate, and be careful:
  caches are shared across branches, so a poisoned cache is a real supply
  chain risk.
- **Self-hosted runners** are free of minute limits but you now own the
  patching, the isolation and the disk cleanup. Teams use them when builds
  need hardware or a huge dependency tree.

## 📊 Metrics worth tracking (DORA)

Four numbers the industry agreed on (DORA research) — teams are judged on
their trend, not the absolute value:

| Metric | Question it answers |
|---|---|
| **Deployment frequency** | how often do we ship? |
| **Lead time for changes** | commit → live: how long? |
| **Change failure rate** | what % of deploys cause an incident? |
| **Time to restore** | when it breaks, how fast is it fixed? |

CI/CD is not "we have a pipeline". It is "we ship smaller batches more
often, and each one is safer". A pipeline that takes 40 minutes and blocks
merges trains people to batch big changes — which is the opposite of the
goal.

## 🏋️ Exercises (doing these IS the lesson)

**(a) Break it on purpose — watch the red X (10 min)**
1. Open `test/counter.test.js`; in the first test change `assert.equal(c.value, 0)` to `assert.equal(c.value, 5)`.
2. Commit + push.
3. In the *Actions* tab watch: lint ✅ passes, test ❌ fails, and **build + deploy + smoke never run** — that's the safety net.
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
Push, watch 12 tests pass. Lesson: adding tests is easy and safe.

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
3. Open a PR in GitHub. Watch the pipeline: lint/test/build run; **deploy and smoke are skipped** (grey).
4. Merge the PR → the push to `main` triggers the pipeline again, and now deploy + smoke run.
Lesson: PRs are "inspect my homework"; pushes to main are "publish it". The `if:` in the deploy job is the gate: deploy only when the branch is `main` **and** the event is not a pull request.

**(e) Add a human approval gate (10 min) — no YAML editing needed**
1. Repo *Settings → Environments* → you will see `production` (created by the deploy job).
2. Open it → *Required reviewers* → add yourself.
3. Push any change to `main`. The deploy job now waits ⏳ for you to click **Approve** in the Actions tab (or in the environment's page).
4. Click Approve → deploy continues → smoke runs → green.
Lesson: CD can still require a human before the truck leaves. This is the difference between *continuous delivery* and *continuous deployment*.

**(f) Make the smoke test earn its keep (10 min)**
1. In `scripts/build.js`, temporarily comment out the copy of `index.html`.
2. Push → build succeeds, deploy succeeds, and **smoke fails** — the live site does not contain the app.
3. Watch the smoke log: it names exactly what is wrong ("does NOT contain the app").
4. Undo and push.
Lesson: green steps ≠ working software. The smoke test is the only job that looks at the *result*, not the *process*.

## 🆘 Troubleshooting

- **"Why can't I double-click index.html?"** — The page uses ES modules (`<script type="module">`), and browsers block module loading from `file://` addresses (a browser security rule, not a bug). Serve it over http instead: `npm run build` then `npm start`, open http://localhost:8080. (The deployed site works because GitHub Pages serves over https.)
- **The deploy job didn't run on my PR** — correct! Deploy only runs on `main` when the event is not a pull request (the `if:` gate). Merge the PR.
- **The smoke job failed but the site looks fine** — you may have hit the propagation delay; the smoke job already retries 10 times over ~50s. If it still fails, check *Deployments → the environment page* for the URL that was actually published.
- **The smoke job says "the live site is STALE"** — the deployed `BUILD_INFO.json` does not match the current commit. Usually a caching/propagation issue, or two runs racing (the `concurrency` block exists to prevent exactly that).
- **I pressed "Run workflow" but nothing deployed** — a manual run deploys only when you start it on the `main` branch; the same gate applies. Run it on `main`.
- **Pages shows 404 right after my first deploy** — wait ~1 minute; confirm *Settings → Pages → Source* is "GitHub Actions".
- **Deploy fails with "no Pages source configured"** — do Quickstart step 3 (*Settings → Pages → Source → "GitHub Actions"*) once, then push again.
- **The Actions tab is empty** — your default branch must be named `main` (the workflow triggers on `main`). Rename `master` → `main` in repo *Settings → Branches*.
- **Pages deploy fails saying the repo must be public** — free-tier Pages works only on public repositories. Make the repo public (or use a paid plan).
- **`npm: command not found`** — Node isn't installed. Install Node 22 (nodejs.org) or skip Local Mode; GitHub's runners already have Node.
- **Tests pass locally but fail in CI** — check versions: the workflow tests Node 20 **and** 22; run `node --version` locally (needs ≥20).
- **The test job shows two entries** — that is the matrix: `test (node 20)` and `test (node 22)`. Both must be green.
- **"YAML error" in Actions** — indentation matters: 2 spaces, never tabs; keep `node-version: "22"` quoted; and remember `environment:` belongs at job level, never inside a step.
- **The run fails instantly with "This run likely failed because of a workflow file issue"** — GitHub rejected the file's *schema*, so there is no job and no log to read. The usual causes: a **job-level key inside `steps:`** (e.g. `environment:`), **`timeout-minutes` under `defaults.run:`** (it is a job-level key), or a tab character. Run `npm run lint` locally — it now checks the workflow's shape and names the offending key. (Valid YAML is not the same as a valid *workflow*; the allowed keys per level are listed in the GitHub *Workflow syntax* docs, and machine-readably in the JSON Schema at `json.schemastore.org/github-workflow.json`.)
- **A secret-scan failure you did not cause** — read the filename it names. It found a credential-shaped string in a committed file: remove it, rotate it, and use a GitHub secret or OIDC instead.

## 📖 Glossary (one line each)

- **CI (Continuous Integration)** — every change is automatically verified (lint + test) before it merges.
- **CD (Continuous Delivery / Continuous Deployment)** — verified changes are published automatically. *Delivery* keeps a human approval; *deployment* does not.
- **Pipeline** — the whole assembly line: commit → lint → test → build → deploy → smoke.
- **Runner** — the fresh, throwaway VM GitHub lends you for one run. Ephemeral by design: it never keeps state between runs.
- **Job** — one station on the line (lint, test, build, deploy, smoke).
- **Step** — one task inside a job (checkout, setup-node, run a command).
- **Matrix** — run one job several ways at once (here: Node 20 and Node 22) so you know your code works on every runtime you support.
- **Artifact** — the packed, immutable build output handed from build to deploy (`dist/`).
- **Environment** — a named target (`production`) that can carry protection rules: required reviewers, wait timers, branch limits.
- **Protection rules** — those rules: "only these people may approve a production deploy".
- **Required status checks** — the repo refuses to merge a PR whose CI is not green.
- **Branch protection** — the repo-level rule that makes the gate real.
- **Gate** — any condition that decides whether a step runs (here: `if: on main and not a PR`).
- **Smoke test** — a check *after* deploy that the live thing actually works, not just that the steps exited 0.
- **Pages** — GitHub's free static hosting; serves the artifact at `https://<user>.github.io/<repo>/`.
- **OIDC** — a trust handshake letting the workflow prove "I am this repo" so Pages deploy needs no stored secret.
- **Lint** — automated static rules that catch mistakes a compiler cannot.
- **ESM** — ES modules, the `import`/`export` system used by all our JS.
- **Concurrency** — the rule that only one pipeline may publish at a time (prevents two deploys racing).
- **Least privilege** — give each job only the permissions it needs, so a compromise stays small.
- **Flaky test** — a test that fails intermittently. Treat it as a bug, not bad luck.
- **Rollback** — returning the system to a previous good state, normally with `git revert` + push.
- **DORA metrics** — deployment frequency, lead time, change failure rate, time to restore.

## 🧹 Done?

- Delete the fork anytime — it cost you nothing. Next steps: try exercises (e) and (f), add branch protection to your fork, then fork a real project and look for its `.github/workflows/`.
- Real next steps for this lab: add a `staging` environment, cache dependencies, add an E2E test with Playwright, and add a `release` workflow that tags a version and publishes it.
