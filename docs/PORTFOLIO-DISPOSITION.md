# Evolution Sandbox — Portfolio Disposition

**Status:** Release Frozen (static-host, static SPA + Canvas
evolution simulation) — React + TypeScript + Vite + Canvas
local-first evolution experiment lab on `origin/main`, **deployed
live at `evolutionsandbox.vercel.app`**. **Eleventh static-host
cluster member**; **sixth static-SPA sub-shape member**. **Sixth
cluster member with Playwright E2E pattern** (60% adoption now).
Notable commit-history pattern: **all features squashed into the
single "Initial commit"** — extreme variant of the monolithic
feat commit pattern; first portfolio repo with this approach.

> Disposition uses strict `origin/main` verification.
> **Single-commit canonical state with substantive features.**

---

## Verification posture

Only `origin` (`saagpatel/EvolutionSandbox`). Clean.

`origin/main`:

- Tip: `6f47475` Initial commit
- **Only 1 commit total.**
- Tree has substantive content:
  - `src/` (full React app source)
  - `tests/` (test suite)
  - `playwright.config.ts` (E2E setup)
  - `package.json` + `package-lock.json` (locked dependencies)
  - `tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`
    (typed config)
  - `eslint.config.js`
  - `docs/`
  - `public/`
  - `.nvmrc` (pinned Node version)
- **Live deploy**: `evolutionsandbox.vercel.app` (per README)
- Default branch: `main`

This single-commit pattern is **distinct from the prior monolithic
feat commit pattern** (NetworkDecoder, LifeCadenceLedger,
DecisionStressTest, ResumeEvolver — all had ≥2 commits with one
big feat commit on top of scaffold). Evolution Sandbox has the
**entire history squashed into one commit**. The operator
prioritized git-history hygiene over commit-by-commit traceability
for this project.

---

## Current state in one paragraph

Evolution Sandbox is a React + TypeScript + Vite + Canvas
**local-first evolution experiment lab** designed to answer one
narrow question quickly: **"What changed, why did it change, and
which pressure caused it?"** The product is deliberately narrow:
**one species + four heritable traits + four environmental
pressures + discrete generations + seeded deterministic replay +
scheduled world changes only at explicit generation markers**.

Three product surfaces:
- **Sandbox** — run the simulation, inspect the population, read
  analytics
- **Scenarios** — edit reusable scenario definitions and
  generation-based pressure events
- **Lab** — save experiments locally, reopen them
  deterministically, pick a baseline for comparison

Current phase adds keyboard-first creature inspection through the
roster. Already deployed at `evolutionsandbox.vercel.app`.

---

## Why "Release Frozen (static-host, static SPA)" — eleventh cluster member

Joins static-SPA sub-shape with a new compute model: **discrete-
generation evolutionary simulation on Canvas**.

| Member | Sub-shape | Compute model |
|---|---|---|
| HowMoneyMoves | Static SPA | Pure presentation |
| Neural Network Playground | Static SPA + TF.js | ML training |
| OrbitMechanic | Static SPA + Canvas 2D | Newtonian physics |
| Signal & Noise | Static SPA + KaTeX + Framer | Interactive math narrative |
| Sovereign | Static SPA + Web Worker | Monte Carlo geopolitical |
| **Evolution Sandbox** | **Static SPA + Canvas** | **Discrete-generation evolutionary simulation** |

Static-SPA sub-shape now at **6 members across 6 distinct compute
models** — most-internally-diverse sub-shape in the portfolio.

Notable: **deterministic replay + seeded simulation** is a
distinguishing simulation quality. Per README: "scheduled world
changes only at explicit generation markers." Combined with saved
experiments + baseline comparison in the Lab surface, this is
genuinely a **research tool** more than a casual sandbox.

Playwright E2E adoption in static-host cluster now **6 of 11 =
55% (was 50% after R18.2)**.

---

## Cluster taxonomy update

| Cluster | Count | Sub-shapes |
|---|---|---|
| **Static-host (web)** | **11** | PWA / static SPA (6) / SSR+Supabase (2) / Next.js+SQLite (2) |
| (others unchanged) | | |

Static-host cluster at 11. Static SPA sub-shape: 6 members.
Playwright E2E: 6 of 11 (55%).

---

## Unblock trigger (operator)

Already deployed at `evolutionsandbox.vercel.app`. Operational
concerns:

1. **Verify deployed instance live + matches latest local code**
   — single-commit history means no easy "what changed since
   deploy" diff.
2. **Run Playwright E2E against production URL** — config exists
   on canonical main; should be wired to deploy pipeline.
3. **Deterministic replay verification** — seed-based reproducibility
   is load-bearing for the research-tool claim. Verify across
   browser updates and Vite version bumps.
4. **Canvas performance budget** — discrete-generation evolution
   with population sizes (TBD per scenario) can spike CPU. Verify
   graceful behavior on lower-end devices.
5. **Lab persistence** — both layers are documented in `docs/architecture.md`: `localStorage` for settings, selected scenario, and current surface; `IndexedDB` (via idb-keyval) for custom scenarios and saved experiment records. Verify these storage contracts survive a Vite or browser update.
6. **Update memory record** — this project wasn't in the
   `MEMORY.md` project-files list per resume prompt. Add an
   entry.

Estimated operator time: ~1 hour for memory update + production
verification.

---

## Portfolio operating system instructions

| Aspect | Posture |
|---|---|
| Portfolio status | `Release Frozen (static-host, static SPA + Canvas evolution simulation)` |
| Distribution channel | **Vercel** (deployed: `evolutionsandbox.vercel.app`) |
| Review cadence | Suspend overdue counting |
| Resurface conditions | (a) Determinism regression (seeded replay breaks), (b) Vite / React major version, (c) Lab persistence format change, (d) v1.1 scope (more species / more traits / non-discrete generations) |
| Co-batch with | Static-host cluster — **now 11 repos** |
| Sub-shape | **Static SPA + Canvas evolutionary simulation** (6th distinct compute model in this sub-shape) |
| Special concern | **Single-commit canonical history.** Extreme variant of monolithic feat pattern — no commit-by-commit traceability. Decide whether to preserve this convention or normalize commit granularity for future features. |
| Special concern | **Deterministic replay** is the research-tool differentiator. Verify across browser / runtime updates. |
| Special concern | **Memory record gap.** Not in operator's project memory; add entry. |

---

## Reactivation procedure

1. Verify branch tracking.
2. Review stash `r18-es-stash` (untracked AGENTS.md only).
3. **Add to memory record**: Evolution Sandbox — React + TS +
   Vite + Canvas evolution simulation, static-host cluster #11,
   deployed at evolutionsandbox.vercel.app.
4. Run Playwright E2E suite.
5. Verify production deploy is current.
6. Test deterministic replay on a saved Lab experiment.

---

## Last known reference

| Field | Value |
|---|---|
| `origin/main` tip | `6f47475` Initial commit (single-commit canonical history) |
| Default branch | `main` |
| Build system | React + TypeScript + Vite + Canvas + Playwright + ESLint |
| Phases shipped | All three surfaces (Sandbox + Scenarios + Lab) + keyboard-first creature inspection; single squashed commit |
| Distribution channel | **Vercel** (deployed: `evolutionsandbox.vercel.app`) |
| Distinguishing tech | **Discrete-generation evolutionary simulation** + **seeded deterministic replay** + **scheduled world changes at explicit generation markers** + three product surfaces (Sandbox / Scenarios / Lab) + saved experiments + baseline comparison |
| Notable | **Single-commit canonical history** — extreme monolithic feat variant, first in portfolio |
| Migration state | No `legacy-origin` remote |
| Distinguishing feature | **Eleventh static-host cluster member; sixth static-SPA sub-shape member with 6th distinct compute model. First single-commit-canonical-history pattern in portfolio.** Already deployed. |
