# WORKFLOW-EXPLAINED.md — the pipeline, line by line

Companion to `.github/workflows/ci-cd.yml`. **Open both side by side.**
This document explains every block: what it does, why it's there, and what
would happen without it.

## The file at a glance

Stripped skeleton (comments removed) so you see the shape before the details:

```yaml
name: CI/CD              # label shown in the Actions tab
on: ...                  # triggers: push to main, PRs, manual button
permissions: ...         # least privilege: read code, write Pages, mint OIDC
concurrency: ...         # only one pipeline touches Pages at a time
jobs:
  lint: ...              # spell check — fast, parallel with test
  test: ...              # taste test — parallel with lint
  build: ...             # pack dist/ — needs lint+test green
  deploy: ...            # the truck — gated: main branch, not a PR
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
- **Why it's here:** least privilege. By default a workflow token is broader than it needs to be; we shrink it on purpose. (Teachable moment: GitHub's own Pages starter uses this same flat shape; per-job permissions would be even tighter.)
- **What if removed:** the default token may still deploy, but with more power than needed — bad habit, and a leaked token would hurt more.

### 6. `concurrency:`

```yaml
concurrency:
  group: pages
  cancel-in-progress: true
```

- **What it does:** all runs share one named "lane" (`pages`). A newer run **cancels** the older in-progress run instead of waiting behind it.
- **Why it's here:** two runs racing to publish different versions of the same site would corrupt Pages. *Cancel* (not *wait*) is chosen because the older run's work is pointless once newer code exists — and cancelling saves runner minutes.
- **What if removed:** double-push fast and two trucks race to the same doorstep.

### 7. `jobs.lint` — the spell check

```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
    - run: npm run lint
```

- **Terminology first:** a **job** is one station on the assembly line; a **step** is one task inside it. This job has three steps.
- `runs-on: ubuntu-latest` — a fresh, throwaway GitHub-hosted Linux VM per run. *Why:* nobody's laptop; identical every time. *Removed:* nothing runs.
- `actions/checkout@v4` — the official action that clones your repo onto the VM. *Removed:* the runner has no code to check.
- `actions/setup-node@v4` + `node-version: "22"` — installs Node. The version is **pinned** so every run uses the same Node (reproducible builds); 22 is a current LTS. *Removed:* Node might still exist on the runner image, but unpinned = surprise breakage later.
- `npm run lint` — our own zero-dependency checker (`scripts/lint.js`): parses every shipped JS file (syntax only) and verifies `index.html` wiring/ids.

### 8. `jobs.test` — the taste test

Same scaffold as lint (checkout → setup-node "22 → `npm test`), deliberately: independent jobs fail independently.

- `npm test` is the bare command `node --test` — Node's built-in runner, nothing to install. **Bare on purpose:** it recursively discovers `test/*.test.js` itself. Passing a directory argument (`node --test test/`) is tempting but **breaks on Windows/macOS with Node ≥ 22** (nodejs/node#64555) — a great real-world example of "the robots check on machines you don't control".
- **Parallel with lint:** lint and test run at the same time on separate VMs (saves minutes). **Independent failure:** lint going red does not silently skip test — each job stands on its own.
- *What if removed:* logic bugs (like a counter that starts at 5) ship to friends.

### 9. `jobs.build` — pack the box

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
- `npm run build` — runs `scripts/build.js`: wipes `dist/`, copies the four site files in, writes `dist/BUILD_INFO.json` (version, timestamp, commit sha).
- `actions/upload-pages-artifact@v3` with `path: dist` — hands the `dist/` **box** to GitHub's artifact storage, where the deploy job can fetch it. The box is called an **artifact**. *Removed:* deploy job has nothing to publish.

### 10. `jobs.deploy` — the delivery truck (and the gate)

```yaml
deploy:
  needs: build
  if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
  # environment: github-pages     # optional approval gate (exercise e)
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
- `actions/configure-pages@v5` — one-time setup telling GitHub this deployment targets Pages.
- `actions/deploy-pages@v4` with `id: deployment` — publishes the artifact to Pages. The `id` exposes outputs, notably `steps.deployment.outputs.page_url` (the live URL).
- The commented `# environment: github-pages` line — **job level** (same indent as `needs:`/`if:`/`runs-on:`) — is the optional human-approval gate from README exercise (e). It is commented out and placed at job level **on purpose**: `environment:` is a job-level key. Uncommenting it *inside a step* produces **invalid YAML** and GitHub rejects the whole file — a trap the lab warns about in README exercise (e).

## Job dependency graph

```
            push / PR / manual dispatch
                        │
           ┌────────────┴────────────┐
           ▼                         ▼
        lint                       test        (parallel; independent)
           └───────────┬─────────────┘
                       ▼  needs: both green
                     build   ── uploads dist/ as a Pages artifact
                       │
                       ▼  if: main branch, and NOT a pull request
                     deploy  ── publishes artifact to GitHub Pages 🚚
```

- `needs` = "wait for". Build waits for lint **and** test; deploy waits for build.
- If lint or test **fails**, build and deploy are **skipped** (grey), not failed — the safety net is *absence*, not error.
- Lint and test run **in parallel**: two stations at once, less wall-clock time.
- The `if:` is the **gate**: it is what makes "merge to main = publish" true.

## PR vs push behavior table

| Event                        | lint | test | build | deploy | Why                                   |
|------------------------------|------|------|-------|--------|---------------------------------------|
| push to main                 | ✅   | ✅   | ✅    | ✅     | a release: inspect, then publish      |
| pull_request targeting main  | ✅   | ✅   | ✅    | ⏭️ skipped | the gate: proposing ≠ publishing (`event_name` is `pull_request`) |
| workflow_dispatch on main    | ✅   | ✅   | ✅    | ✅     | manual demo run: not a PR, ref is main |
| workflow_dispatch on another branch | ✅ | ✅ | ✅  | ⏭️ skipped | ref is not `refs/heads/main`        |
| push to any other branch     | ✅   | ✅   | ✅    | ⏭️ skipped | not `refs/heads/main` yet            |

## Glossary

- **CI (Continuous Integration)** — robots automatically check every change (lint + test) before it goes anywhere.
- **CD (Continuous Delivery/Deployment)** — robots automatically deliver the checked change (build + deploy).
- **Pipeline** — the whole assembly line: commit → lint → test → build → deploy.
- **Runner** — the fresh, throwaway computer GitHub lends you for one pipeline run.
- **Job** — one station on the line (lint, test, build, deploy).
- **Step** — one task inside a job (checkout, install Node, run a command).
- **Artifact** — the packed box (`dist/`) handed from build to deploy via GitHub's storage.
- **Environment** — a named place (like `github-pages`) that can require human approval before a job runs.
- **Pages** — GitHub's free static-site hosting; serves the artifact at `https://<user>.github.io/<repo>/`.
- **OIDC** — a trust handshake (`id-token: write`) letting the workflow prove "I am really this repo" so the Pages deploy needs no stored secret.
- **Lint** — automated style/syntax checking ("spell check for code").
- **Bonus terms:**
  - **Concurrency** — the rule that only one pipeline may publish at a time (`group: pages` + `cancel-in-progress`).
  - **Permissions** — the shrunken token powers (`contents: read`, `pages: write`, `id-token: write`); least privilege.
  - **`needs`** — a job-level "wait for these jobs to be green first".
  - **`if`** — a job-level gate evaluated before the job starts; false = skipped (grey).
  - **ESM** — ES modules, the `import`/`export` system used by all our JS.

## Common questions

- *Why didn't deploy run on my PR?* — By design; the `if:` gate. PRs are inspections, not releases. Merge to `main`.
- *Why DID deploy run when I pressed "Run workflow"?* — If you started it on `main`: the gate only excludes pull requests, so a manual run on the main branch is trusted like a push. On any other branch it stays parked.
- *What is OIDC actually doing here?* — `id-token: write` lets the runner mint a short-lived token proving its identity, so `deploy-pages` can publish with **zero stored secrets**. Nothing to leak, nothing to rotate.
- *Where does the site actually live?* — The uploaded artifact is published by Pages at `https://<user>.github.io/<repo>/`. The deploy job never touches a server.
- *Why cancel-in-progress instead of queueing?* — A newer push makes the older run's work pointless; cancelling saves minutes and prevents two versions racing to publish.
