# Evolution Sandbox

A local-first evolution experiment lab built with React, TypeScript, Vite, and Canvas.

Live demo: [evolutionsandbox.vercel.app](https://evolutionsandbox.vercel.app)

## Product goal

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

## Best first run

If you are opening the app cold, use this order:

1. `Balanced World` to learn the layout
2. `Predator Pulse` to see a sharp squeeze and rebound
3. `Cold Snap Recovery` to see a staged survival-and-diversity recovery story

Inside the app, the quickstart guide now walks a reviewer through that same path step by step.

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run check
npm run test:e2e
```

For a full deployment-ready gate:

```bash
npm run ship:check
```

## Recommended deployment

Use **Vercel** as the default host for v1.

Why:

- this is a static Vite app
- there is no backend or secret-handling requirement
- preview deployments are useful for portfolio review
- rollback is straightforward

The repo includes a ready-to-use `vercel.json` and a deployment runbook in `docs/deployment.md`.

## Portfolio-ready release flow

1. Run `npm run ship:check`.
2. Open a local preview with `npm run preview`.
3. Manually test the Sandbox, Scenarios, and Lab flows.
4. Test one scenario import and one experiment import from the built-in example downloads.
5. Refresh the reviewer captures listed in `docs/reviewer-capture.md`.
6. Deploy to Vercel.

Use `docs/manual-qa.md` as the checklist for the live/manual portion of that pass.

## Repo guide

- `src/domain` — deterministic simulation logic, scenario normalization, metrics, summaries, comparison
- `src/app` — session controller, run loop, scenario orchestration, and lab flows
- `src/ui` — controls, charts, canvas, panels, timeline, and scenario/lab surfaces
- `src/infra` — lightweight session persistence and IndexedDB-backed lab storage
- `tests/unit` — deterministic engine, storage, comparison, and app-shell tests
- `tests/e2e` — browser smoke for the reviewer, save, reopen, and compare workflow
- `docs` — implementation contracts, architecture notes, and balance guidance

## Source-of-truth docs

- `docs/simulation-contract.md`
- `docs/architecture.md`
- `docs/artifact-contract.md`
- `docs/accessibility.md`
- `docs/balance-log.md`
- `docs/deployment.md`
- `docs/manual-qa.md`
- `docs/screen-reader-pass.md`
- `docs/reviewer-capture.md`
- `docs/reviewer-validation-report.md`
- `docs/reviewer-assets/README.md`
