# Manual QA Matrix

This file is the source of truth for human validation before calling a build release-ready.

## Triage labels

- `blocker`
  - a flow is broken, misleading, or inaccessible enough that the portfolio version should not ship
- `should-fix`
  - a flow works, but it still creates confusion or unnecessary friction
- `acceptable-for-now`
  - a known rough edge that does not break trust or the core reviewer path

## Ship / no-ship rule

Do not call the app release-ready until:

- all `blocker` items are resolved
- every `should-fix` item is either resolved or explicitly deferred with a reason
- the release gate and this checklist both pass on the current build

## Validation environments

Run the matrix in both:

1. local production preview
2. deployed live app in a clean browser session

Record the date, environment, and any findings at the bottom of this document.

Refresh reviewer screenshots or a short task clip with `docs/reviewer-capture.md` if this pass changes the visible flow.

## Keyboard-only flow

### Surface switching

Steps:
- open the app and do not use a mouse
- move across `Sandbox`, `Scenarios`, and `Lab` with `Tab`
- switch surfaces with left/right arrows
- verify `Home` returns to `Sandbox`
- verify `End` reaches `Lab`

Expected:
- the selected tab is visually obvious
- focus stays on the active tab after arrow-key switching
- the associated panel changes immediately

### Sandbox flow

Steps:
- use the quickstart path without a mouse
- run a scenario
- scrub generations with the timeline range input
- move to an event marker button and activate it
- select a creature from the roster
- save a completed run and compare against a baseline

Expected:
- no focus trap occurs during run/save/compare
- timeline and inspector remain understandable without the canvas
- comparison can be reached without hover-only discovery

## Reduced-motion flow

Steps:
- enable `prefers-reduced-motion`
- open the Sandbox
- inspect the phenotype field while scrubbing generations and selecting a creature

Expected:
- ambient phenotype animation stops
- information still remains readable through canvas labels, roster, inspector, and summaries

## Screen reader flow

Test with at least one supported screen reader:
- VoiceOver on macOS or iOS
- NVDA on Windows

Steps:
- open the app
- switch surfaces
- trigger quickstart actions
- change generations
- select and clear a creature
- save a baseline
- open an import review

Expected:
- state changes are announced without repeating every simulation tick
- import review explains the file outcome clearly
- selection and baseline changes are understandable
- the canvas is treated as a visual surface with a usable text alternative

## Import/export trust flow

### Scenario artifact

Steps:
- download the built-in `Balanced World` example
- import it from `Scenarios`
- confirm the review outcome
- verify dedupe behavior if the scenario already exists

Expected:
- the file is reviewed before local state changes
- duplicate outcomes are explained clearly
- no silent overwrite occurs

### Experiment artifact

Steps:
- download the sample experiment
- import it from `Lab`
- confirm the review outcome
- reopen or compare the imported experiment

Expected:
- the review step explains replay trust clearly
- imported runs can be reopened deterministically
- blocked or incompatible files explain why they were rejected

## Reviewer path

Steps:
- follow the recommended cold-review path:
  - run `Balanced World`
  - save the baseline
  - load `Predator Pulse`
  - compare the runs
  - try one example artifact download/import

Expected:
- the strongest path is obvious in under three minutes
- docs and in-app guidance tell the same story
- a reviewer can discover the artifact workflow without guessing

## Findings log

### 2026-04-13 audit

- `should-fix` Resolved
  - Import review used a blocked primary action that looked like a disabled exit path instead of a working close action.
- `should-fix` Resolved
  - Keyboard users were not clearly moved into the import review surface after file selection.
- `should-fix` Resolved
  - The Lab surface did not show the built-in artifact examples, which made the sharing flow easier to discover from Scenarios than from the import destination itself.
- `should-fix` Resolved
  - Import review did not return focus to a stable import control after canceling or closing the review.
- `acceptable-for-now`
  - A real OS-level screen reader pass still has to be completed manually outside this repo environment.

### 2026-04-13 validation run

- Environment
  - local production preview
  - deployed live app
- Verified
  - local preview loaded correctly
  - live deployment responded successfully
  - keyboard tab switching still works with left/right plus Home/End
  - the skip link appears as the first keyboard stop
  - Lab import controls are reachable from the keyboard
  - reduced-motion emulation matched correctly in local preview
- Still pending
  - a human screen-reader pass with VoiceOver or NVDA

Use `docs/screen-reader-pass.md` for that final human-only close-out.
