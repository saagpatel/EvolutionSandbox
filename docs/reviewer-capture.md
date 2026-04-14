# Reviewer Capture Guide

Use this guide when refreshing screenshots or a short GIF for the portfolio/demo path.

## Capture set

Refresh these assets whenever the top-level flow or UI hierarchy changes materially:

1. `sandbox-overview`
   - show the Sandbox surface with:
     - quickstart visible
     - roster visible
     - timeline visible
     - one completed run or clearly readable mid-run state
2. `comparison-story`
   - show the comparison panel with a saved baseline active
   - preferred pairing:
     - `Balanced World` baseline
     - `Predator Pulse` comparison run
3. `import-review`
   - show the import review step for either:
     - a duplicate scenario outcome
     - a replay-trusted experiment outcome
4. `lab-library`
   - show the Lab with:
     - at least one saved experiment
     - baseline selected
     - example artifact panel visible

## Capture rules

- Prefer desktop captures from the local production preview or the deployed live app.
- Keep browser chrome out of the frame when possible.
- If you record motion, keep it short and task-based:
  - switch surfaces
  - import example artifact
  - compare baseline
- Do not capture temporary notices unless they are the point of the image.
- If UI changed materially, replace stale assets instead of adding near-duplicates.

## Suggested reviewer sequence

If you only have time for one screenshot and one motion clip:

1. screenshot `sandbox-overview`
2. short clip of:
   - import example scenario
   - run baseline
   - compare against `Predator Pulse`

## Pre-capture checklist

- Run `npm run ship:check`.
- Run the manual QA matrix in `docs/manual-qa.md`.
- Confirm the README still matches the visible reviewer path.
- Use current example artifacts, not local one-off files.
