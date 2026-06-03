<!-- portfolio-context:start -->
# Portfolio Context

## What This Project Is

Evolution Sandbox is designed to answer one question quickly:

What changed, why did it change, and which pressure caused it?

The app stays deliberately narrow:

- one species
- four heritable traits
- four environmental pressures
- discrete generations
- seeded deterministic replay
- scheduled world changes only at explicit generation markers

The product is organized into three surfaces:

- `Sandbox` — run the simulation, inspect the population, and read the analytics
- `Scenarios` — edit reusable scenario definitions and generation-based pressure events
- `Lab` — save experiments locally, reopen them deterministically, and pick a baseline for comparison

The current phase also adds:

- keyboard-first creature inspection through the roster
- live announcements for important state changes
- portable JSON artifacts for scenarios and saved experiments
- review-before-import so files are previewed before they touch local state
- built-in downloadable example artifacts for reviewer testing
- a guided quickstart path for first-time reviewers

This is intentionally not:

- a real-time ecosystem sim
- a predator chase toy
- a fake-genetics content machine
- a cloud product with accounts or sync

## Current State

Portfolio truth marks this project as `Release Frozen` (static-host, static SPA + Canvas evolution simulation). A full portfolio disposition is in `docs/PORTFOLIO-DISPOSITION.md`.

## Stack

- Primary stack: React, TypeScript
- JavaScript package manager: npm-compatible workflow

## How To Run

```bash
npm install
npm run dev
```

## Known Risks

- Deterministic replay correctness is load-bearing for the research-tool claim; verify across browser and runtime updates.
- Canvas performance on lower-end devices has not been profiled against a production population size budget.

## Next Recommended Move

Verify the live deployment at `evolutionsandbox.vercel.app` matches the current code state. See `docs/PORTFOLIO-DISPOSITION.md` for the reactivation procedure and resurface conditions.

<!-- portfolio-context:end -->

<!-- secondbrain-breadcrumb -->
## SecondBrain knowledge vault

Prior lessons, decisions, and context for this project live in SecondBrain at `wiki/maps/projects/evolution-sandbox.md`. The whole vault is searchable via the `engraph` MCP — query it for this project + its stack before non-trivial work.
