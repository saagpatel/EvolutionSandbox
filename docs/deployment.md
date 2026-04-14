# Deployment Guide

## Recommended host

Use **Vercel** for the first public deployment.

Why this is the best fit for this project:

- the app is a static Vite frontend
- there is no backend, auth layer, or secret management requirement
- preview deployments are useful for portfolio review
- rollback is simple because releases are just static builds

## Local release gate

Run this before every deploy:

```bash
npm install
npm run ship:check
```

What that covers:

- lint
- typecheck
- unit tests
- browser smoke tests
- production build

## Local production preview

Use this when you want to sanity-check the real production bundle locally:

```bash
npm run build
npm run preview
```

Then manually confirm:

- the app loads without console errors
- the Sandbox, Scenarios, and Lab surfaces all open
- a completed run can be saved to the Lab
- a saved experiment can be reopened
- baseline comparison still works
- canvas selection and roster selection both still drive the inspector
- example artifact downloads still work
- import review appears before imported files change local state

## Vercel setup

Recommended settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Node version: `22.x` or newer

The repo also includes `vercel.json` so the project can be imported with minimal manual setup.

## Release checklist

Before promoting a deployment as the portfolio version:

1. Run `npm run ship:check`.
2. Open a local preview and do the manual smoke checklist.
3. Run the manual QA matrix in `docs/manual-qa.md`.
4. Confirm the README still matches the product surface and controls.
5. Refresh the reviewer captures in `docs/reviewer-capture.md`.
6. Deploy to Vercel.
7. Open the live app in a clean browser session and repeat the manual QA matrix.

## Known pre-launch notes

- The analytics chunk is still the heaviest asset in the build. This is acceptable for now because it is lazy-loaded, but it is the first performance surface to revisit if the live app feels sluggish.
- Saved lab data is version-aware. Incompatible saved records are now cleared with a warning notice instead of failing silently.
