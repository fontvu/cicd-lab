# WORKFLOW-EXPLAINED.md — the pipeline, line by line

Companion to `.github/workflows/ci-cd.yml`. **Open both side by side.**
This document explains every block: what it does, why it's there, and what
would happen without it.

## The file at a glance

Stripped skeleton (comments removed) so you see the shape before the details:

```yaml
name: CI/CD              # label shown in the Actions tab
on: ...                  # triggers: push to main, PRs, manual button
permissions: ...         # workflow-wide default: least privilege
concurrency: ...         # only one pipeline touches Pages at a time
# each job: timeout-minutes: 10   # a hung job must not burn runner minutes
jobs:
  lint: ...              # spell check — fast, parallel with test
  test: ...              # taste test — parallel with lint, on Node 20 AND 22
  build: ...             # pack dist/ — needs lint+test green
  deploy: ...            # the truck — gated: main branch, not a PR
  smoke: ...             # fetch the LIVE site and prove it works
```

## Line-by-line walkthrough

For each block: **quoted YAML → what it does → why it's there → what if removed.**

### 1. `name: CI/CD`

```yaml
name: CI/CD
```

- **What it does:** labels the workflow in the GitHub *Actions* tab.
- **Why it's here:** so humans can find it ("CI/CD", not "workflow-yml-2").
- **What if removed:** GitHub invents a name from the filename (`ci-cd`). Harmless, but less clear.

### 2. `on: push: branches: [main]`

```yaml
on:
  push:
    branches: [main]
```

- **What it does:** runs the whole pipeline on every push to the `main` branch.
- **Why it's here:** a push to `main` is a **release** — it is the event allowed to reach the deploy job (via the gate in job 4).
- **What if removed:** pushes would do nothing. No automation at all — back to manual uploads.

### 3. `on: pull_request: branches: [main]`

```yaml
  pull_request:
    branches: [main]
```

- **What it does:** runs lint/test/build on every Pull Request targeting `main` — **before** it is merged.
- **Why it's here:** this is the inspection moment. A PR is a proposal ("inspect my homework"); robots check it, but the gate in the deploy job keeps the truck parked.
- **What if removed:** PRs merge unchecked. The single most valuable safety moment of the whole pipeline disappears.

### 4. `on: workflow_dispatch`

```yaml
  workflow_dispatch:
```

- **What it does:** adds a *Run workflow* button in the Actions tab so a human can start the pipeline on demand.
- **Why it's here:** handy for demos and re-runs without pushing new code. Honest behaviour: it runs the full pipeline, and — because the deploy gate checks *branch + not-a-PR*, not "push only" — a manual run **on `main` also deploys**. Run it on any other branch and it stops after build.
- **What if removed:** no on-demand button; you must push (even an empty commit) to re-run.

### 5. `permissions:`

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

- **What it does:** shrinks the workflow's token to exactly three powers.
  - `contents: read` → clone the repo (the checkout action needs this).
  - `pages: write` → upload the built site and publish it to Pages.
  - `id-token: write` → mint a short-lived **OIDC** token so the deploy proves "I am really this repo" **without any long-lived secret stored in the repository**. No secrets = nothing to leak.
- **Why it's here:** least privilege. By default a workflow token is broader than it needs to be; we shrink it on purpose.
- **The nuance that matters at work:** this block is only the **default**. Each job below overrides it with its own `permissions:`, so `lint`/`test`/`build`/`smoke` run with `contents: read` only, and only `deploy` can write to Pages. Defence in depth: do not rely on one line to keep the blast radius small — make the narrow jobs narrow too.
- **What if removed:** the default token may still deploy, but with more power than needed — bad habit, and a leaked token would hurt more.

### 6. `concurrency:`

```yaml
concurrency:
  group: pages
  cancel-in-progress: true
```

- **What it does:** all runs share one named "lane" (`pages`). A newer run **cancels** the older in-progress run instead of waiting behind it.
- **Why it's here:** two runs racing to publish different versions of the same site would corrupt Pages. *Cancel* (not *wait*) is chosen because the older run's work is pointless once newer code exists — and cancelling saves runner minutes.
- **The trade-off:** for a long production release you would flip this to `false` (queue instead of cancel) so a half-finished run is not killed mid-flight.
- **What if removed:** double-push fast and two trucks race to the same doorstep.

### 7. `timeout-minutes` — the job-level safety net

```yaml
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10        # a hung step must not burn runner minutes
```

- **What it does:** the job is killed after 10 minutes.
- **Why it's here:** a hung step (a network call that never returns, an infinite loop) would otherwise keep a runner busy and burn your monthly minutes for nothing.
- **What if removed:** the pipeline can hang until GitHub's own hard limit (6 hours). Your quota bleeds, and nobody notices for hours.
- ⚠️ **THE TRAP THAT COST US A RUN** — `timeout-minutes` is a **job-level** key. Putting it under a workflow-level `defaults.run:` block looks reasonable and is **rejected by GitHub**, which then reports the run as a bare *"workflow file issue"* with **no jobs and no logs**. The YAML is valid; the *schema* is not. Our linter now checks the allowed keys at each level (and a regression test reproduces the mistake) so this can never waste a run again. The same class of trap: putting a job-level key inside `steps:`.
- **Where the allowed keys live:** the *Workflow syntax* page in the GitHub docs lists them per key — and the JSON Schema at `json.schemastore.org/github-workflow.json` is machine-readable. Serious pipelines validate against that schema in a pre-commit hook.

### 8. `jobs.lint` — the spell check

```yaml
lint:
  runs-on: ubuntu-latest
  permissions:
    contents: read
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
    - run: npm run lint
```

- **Terminology first:** a **job** is one station on the assembly line; a **step** is one task inside it. This job has three steps.
- `runs-on: ubuntu-latest` — a fresh, throwaway GitHub-hosted Linux VM per run. *Why:* nobody's laptop; identical every time. *Removed:* nothing runs.
- `permissions: contents: read` — this job only reads code. If someone later pasted a deploy step into it by accident, it still could not publish.
- `actions/checkout@v4` — the official action that clones your repo onto the VM. *Removed:* the runner has no code to check.
- `actions/setup-node@v4` + `node-version: "22"` — installs Node. The version is **pinned** so every run uses the same Node (reproducible builds); 22 is a current LTS. *Removed:* Node might still exist on the runner image, but unpinned = surprise breakage later.
- `npm run lint` — our own zero-dependency checker (`scripts/lint.js`): parses every shipped JS file (syntax only), verifies `index.html` wiring/ids, checks that the npm scripts the pipeline calls still exist in `package.json`, and scans the repo for accidentally committed secrets.

### 9. `jobs.test` — the taste test (and the matrix)

```yaml
test:
  runs-on: ubuntu-latest
  permissions:
    contents: read
  strategy:
    fail-fast: false
    matrix:
      node-version: [20, 22]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "${{ matrix.node-version }}"
    - run: npm test
```

- Same scaffold as lint (checkout → setup-node → `npm test`), deliberately: independent jobs fail independently.
- `npm test` is the bare command `node --test` — Node's built-in runner, nothing to install. **Bare on purpose:** it recursively discovers `test/*.test.js` itself. Passing a directory argument (`node --test test/`) is tempting but **breaks on Windows/macOS with Node ≥ 22** (nodejs/node#64555) — a great real-world example of "the robots check on machines you don't control".
- **The matrix:** `matrix.node-version: [20, 22]` means *run this job once per value*. The Actions tab shows two checks — `test (node 20)` and `test (node 22)`. This is the cheapest insurance in CI: your code must pass on every runtime you claim to support (`package.json` says `engines.node >= 20`).
- `fail-fast: false` — do **not** cancel the other leg when one fails. You want to know about every broken runtime in one run, not discover them one at a time.
- **Parallel with lint:** lint and test run at the same time on separate VMs (saves minutes). **Independent failure:** lint going red does not silently skip test — each job stands on its own.
- *What if removed:* logic bugs (like a counter that starts at 5) ship to friends — and you would find out on the version you support least.

### 10. `jobs.build` — pack the box

```yaml
build:
  needs: [lint, test]
  steps:
    - run: npm run build
    - uses: actions/upload-pages-artifact@v3
      with:
        path: dist
```

- `needs: [lint, test]` — this job **waits** until both pass. If either failed, build is **skipped** (grey, not red). Broken code never even gets packed. *Removed:* build would run even on broken code — pointless boxes.
- `npm run build` — runs `scripts/build.js`: wipes `dist/`, copies the site files in (including the slide deck), writes `dist/BUILD_INFO.json` (version, timestamp, commit sha).
- `actions/upload-pages-artifact@v3` with `path: dist` — hands the `dist/` **box** to GitHub's artifact storage, where the deploy job can fetch it. The box is called an **artifact**. *Removed:* deploy job has nothing to publish.

### 11. `jobs.deploy` — the delivery truck (and the gate)

```yaml
deploy:
  needs: build
  if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
  permissions:
    contents: read
    pages: write
    id-token: write
  environment:
    name: production
    url: ${{ steps.deployment.outputs.page_url }}
  outputs:
    page_url: ${{ steps.deployment.outputs.page_url }}
  steps:
    - uses: actions/configure-pages@v5
    - uses: actions/deploy-pages@v4
      id: deployment
```

- `needs: build` — only after a successful build (and therefore after lint+test too).
- **The `if:` gate, in full:** the job runs only when the branch is `main` (`github.ref == 'refs/heads/main'`) **AND** the event is not a pull request (`github.event_name != 'pull_request'`). Consequences:
  - push to `main` → deploys ✅
  - manual *Run workflow* on `main` → deploys ✅ (not a PR, and ref is main)
  - any pull_request → **skipped** ⏭️ (proposing ≠ publishing)
  - push or manual run on any other branch → **skipped** ⏭️ (not `refs/heads/main`)
  *Removed:* the truck would leave on every run — including PRs from forks. That is the one mistake this lab exists to prevent.
- `permissions:` — the only job that can write to Pages. Everything else is read-only.
- `environment: production` — names the **target environment**. In *Settings → Environments* you can attach **protection rules** to it: required reviewers, a wait timer, branch restrictions. Add "required reviewers" and this pipeline becomes **continuous delivery** (a human approves the release) instead of **continuous deployment** (it ships unattended). With no rules set, it runs straight through — which is what this lab does by default.
- `outputs: page_url` — publishes the live URL so the **next** job (`smoke`) can use it as `needs.deploy.outputs.page_url`.
- `actions/configure-pages@v5` — one-time setup telling GitHub this deployment targets Pages.
- `actions/deploy-pages@v4` with `id: deployment` — publishes the artifact to Pages. The `id` exposes outputs, notably `steps.deployment.outputs.page_url` (the live URL).

### 12. `jobs.smoke` — did it actually work?

```yaml
smoke:
  needs: deploy
  steps:
    - run: curl -fsSL --retry 10 --retry-all-errors --retry-delay 5 "$URL" -o /tmp/index.html
    - run: grep -q "magic-button" /tmp/index.html
    - run: test "$DEPLOYED" = "$GITHUB_SHA"
```

- **What it does:** fetches the **live** URL and proves three things: the page is reachable, it contains our app, and it was built from *this* commit.
- **Why it's here:** a green pipeline means "the steps exited 0". It does **not** mean "the site works for users". That gap is where real incidents live — a deploy can succeed and serve a 404, an empty page, or last week's build.
- `--retry 10 --retry-all-errors --retry-delay 5` — GitHub Pages takes a few seconds to propagate a new deployment. Retry logic belongs in the **checker**, not only in the deploy.
- **`env:` instead of inline `${{ }}`** — the URL is passed as an environment variable rather than pasted into the shell script. If a value ever contained shell syntax it would be data, not code. The value here is trusted (it comes from our own deploy step), but the habit is what keeps you safe later.
- **Why it can turn the pipeline red *after* a successful deploy:** that is the point. You want to know within a minute, while the fix (redeploy, or `git revert`) is still minutes away.
- *What if removed:* the pipeline would report "success" for a site that 404s. Green is not the same as working.

## Job dependency graph

```
            push / PR / manual dispatch
                        │
           ┌────────────┴────────────┐
           ▼                         ▼
        lint                       test        (parallel; independent)
                                       │
                          ┌────────────┴────────────┐
                          ▼                         ▼
                   test (node 20)          test (node 22)   ← the matrix
                          └────────────┬────────────┘
                                       ▼  needs: all green
                     build   ── uploads dist/ as a Pages artifact
                       │
                       ▼  if: main branch, and NOT a pull request
                     deploy  ── publishes artifact to GitHub Pages 🚚
                       │        (environment: production)
                       ▼
                     smoke   ── fetches the live URL and verifies it 🌐
```

- `needs` = "wait for". Build waits for lint **and** both test legs; deploy waits for build; smoke waits for deploy.
- If lint or test **fails**, build and deploy are **skipped** (grey), not failed — the safety net is *absence*, not error.
- Lint and test run **in parallel**: two stations at once, less wall-clock time.
- The `if:` is the **gate**: it is what makes "merge to main = publish" true.

## PR vs push behavior table

| Event                        | lint | test | build | deploy | smoke | Why                                   |
|------------------------------|------|------|-------|--------|-------|---------------------------------------|
| push to main                 | ✅   | ✅   | ✅    | ✅     | ✅    | a release: inspect, then publish, then verify |
| pull_request targeting main  | ✅   | ✅   | ✅    | ⏭️ skipped | ⏭️ skipped | the gate: proposing ≠ publishing (`event_name` is `pull_request`) |
| workflow_dispatch on main    | ✅   | ✅   | ✅    | ✅     | ✅    | manual demo run: not a PR, ref is main |
| workflow_dispatch on another branch | ✅ | ✅ | ✅  | ⏭️ skipped | ⏭️ skipped | ref is not `refs/heads/main`        |
| push to any other branch     | ✅   | ✅   | ✅    | ⏭️ skipped | ⏭️ skipped | not `refs/heads/main` yet            |

## Glossary

- **CI (Continuous Integration)** — every change is automatically verified (lint + test) before it merges.
- **CD (Continuous Delivery / Continuous Deployment)** — verified changes are published automatically. *Delivery* keeps a human approval; *deployment* does not.
- **Pipeline** — the whole assembly line: commit → lint → test → build → deploy → smoke.
- **Runner** — the fresh, throwaway VM GitHub lends you for one run.
- **Job** — one station on the line (lint, test, build, deploy, smoke).
- **Step** — one task inside a job (checkout, setup-node, run a command).
- **Matrix** — run one job several ways at once (here: Node 20 and Node 22).
- **Artifact** — the packed, immutable build output handed from build to deploy.
- **Environment** — a named target (`production`) that can carry protection rules.
- **Pages** — GitHub's free static-site hosting; serves the artifact at `https://<user>.github.io/<repo>/`.
- **OIDC** — a trust handshake (`id-token: write`) letting the workflow prove "I am really this repo" so the Pages deploy needs no stored secret.
- **Lint** — automated static rules that catch mistakes a compiler cannot.
- **Smoke test** — a check *after* deploy that the live thing actually works.
- **Bonus terms:**
  - **Concurrency** — the rule that only one pipeline may publish at a time (`group: pages` + `cancel-in-progress`).
  - **Permissions** — the shrunken token powers (`contents: read`, `pages: write`, `id-token: write`); least privilege, per job.
  - **`needs`** — a job-level "wait for these jobs to be green first".
  - **`if`** — a job-level gate evaluated before the job starts; false = skipped (grey).
  - **`outputs`** — a job-level way to hand a value (here the live URL) to later jobs.
  - **ESM** — ES modules, the `import`/`export` system used by all our JS.

## Common questions

- *Why didn't deploy run on my PR?* — By design; the `if:` gate. PRs are inspections, not releases. Merge to `main`.
- *Why DID deploy run when I pressed "Run workflow"?* — If you started it on `main`: the gate only excludes pull requests, so a manual run on the main branch is trusted like a push. On any other branch it stays parked.
- *What is OIDC actually doing here?* — `id-token: write` lets the runner mint a short-lived token proving its identity, so `deploy-pages` can publish with **zero stored secrets**. Nothing to leak, nothing to rotate.
- *Where does the site actually live?* — The uploaded artifact is published by Pages at `https://<user>.github.io/<repo>/`. The deploy job never touches a server.
- *Why cancel-in-progress instead of queueing?* — A newer push makes the older run's work pointless; cancelling saves minutes and prevents two versions racing to publish.
- *Do I need the smoke job in a real project?* — Usually yes, and more of them: a post-deploy health check is the cheapest way to find out that a "successful" deploy broke the site. Bigger systems add synthetic monitoring, error-rate alerts and automatic rollback on top.
- *What about the database?* — Not in this lab, and that is the classic hard part: migrations must be backwards-compatible with the currently running version, or a rollback becomes impossible. It is the first thing to read up on before doing real releases.
