# Architecture Notes

## Core rule

The simulation engine is the source of truth.

The UI does not compute fitness, comparison, or summaries on its own. It only renders engine outputs.

## Boundaries

- `src/domain`
  - pure simulation, scenario, metric, and comparison logic only
  - no React
  - no browser APIs
- `src/app`
  - session reducer
  - run loop orchestration
  - scenario selection and editor orchestration
  - lab flows such as save, reopen, and baseline selection
  - import review orchestration before scenario or experiment files mutate local state
  - accessibility announcements and quickstart guidance
- `src/ui`
  - read-only views over current state
  - canvas rendering
  - charts
  - scenario builder and lab surfaces
  - accessible text equivalents and guided reviewer flow
- `src/infra`
  - lightweight session persistence in `localStorage`
  - IndexedDB-backed scenario and experiment storage
  - schema/version handling
  - browser file import/export helpers

## Public artifact boundary

The app now has a public artifact contract separate from browser persistence:

- scenarios export as normalized JSON files
- experiments export as deterministic recipe + compact summary JSON files
- imports pass through a review step before confirmation
- imports are validated strictly before they affect local state
- replay trust is enforced by regenerating experiment runs and checking `runHash`

## Persistence scope

The app now uses two persistence layers:

- `localStorage`
  - normalized active config
  - selected scenario id
  - selected baseline experiment id
  - current surface
- IndexedDB
  - custom scenarios
  - saved experiment records
  - compact completed-run summaries plus deterministic replay recipes

The lab does not persist full creature-by-creature run history. Reopened experiments are regenerated locally from the saved recipe.

Portable artifacts are not direct dumps of those internal storage records.

## Scenario model

- Built-in scenarios are immutable in place.
- Custom scenarios are stored as reusable `ScenarioDefinition` records.
- Scenario events are explicit generation-based pressure overrides.
- Event values persist until replaced by a later event for the same pressure.
- The engine stores `appliedPressures` on each post-initial generation snapshot so charts, summaries, and timeline markers all reflect the same world state.

## Comparison model

- Comparison is capped at two runs.
- The active sandbox run is the primary run.
- A saved experiment selected in the lab acts as the baseline.
- Comparison stays disabled when ruleset versions do not match.

## Accessibility model

- tabs own top-level surface switching
- the creature roster owns keyboard creature selection
- the canvas remains a visual surface
- the inspector and text analytics provide the non-visual equivalent
- the app uses polite live announcements for meaningful state changes only

## Performance posture

- keep the engine serializable
- keep fast-forward generation-count based
- regenerate saved experiments locally instead of storing heavy archives
- add a Web Worker only if profiling proves the main thread is not enough
