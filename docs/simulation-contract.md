# Evolution Sandbox Simulation Contract

## Determinism

Evolution Sandbox treats a run as deterministic when all of the following match:

- normalized scenario
- normalized config
- seed
- simulation ruleset version

If those inputs match, the completed run hash must also match.

## Scenario event semantics

- A scenario contains a base config plus zero or more scheduled events.
- Events are sorted and normalized before hashing.
- Each event can override one or more of the four existing pressures only.
- Event generations must be unique integers inside the scenario's generation target.
- Event values persist until a later event replaces that same pressure.
- Unspecified pressures inherit the most recently active value.

## Snapshot semantics

- `GenerationSnapshot[0]` is the initialized population before any survival filtering.
- Each later snapshot represents the post-selection, post-reproduction population for that generation.
- The survival rate stored on a snapshot describes the selection pass that produced that generation's population.
- Each post-initial snapshot also stores:
  - `appliedPressures`
  - `triggeredScenarioEvent` when an event begins on that generation
  - `activeScenarioEvent` when a scheduled event is currently shaping the world

## Storage

The app uses two persistence layers.

- `localStorage`
  - normalized active config
  - selected scenario id
  - selected baseline experiment id
  - active surface
- IndexedDB
  - custom scenario definitions
  - saved experiments
  - compact completed-run summaries
  - the run recipe needed to regenerate the full run locally

The lab never persists full generation snapshots or full run history archives.

## Comparison

Comparison is only supported between:

- the current completed run in memory
- one saved baseline experiment selected from the local lab

Comparison is disabled when the ruleset version or storage schema does not match.
