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

Portfolio truth currently marks this project as `active` with `minimum-viable` context. Phase 104 recovered minimum-viable context so future sessions can resume without rediscovery.

## Stack

- Primary stack: React, TypeScript
- JavaScript package manager: npm-compatible workflow

## How To Run

```bash
npm install
npm run dev
```

## Known Risks

- This repo only has minimum-viable recovery context today; deeper handoff details may still live in the README and supporting docs.

## Next Recommended Move

Use this context plus the README and supporting docs to resume the next active task, then promote the repo beyond minimum-viable by capturing a dedicated handoff, roadmap, or discovery artifact.

<!-- portfolio-context:end -->
