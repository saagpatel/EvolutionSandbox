# Portable Artifact Contract

## Scope

Portable artifacts are the public file format for sharing scenarios and saved experiments outside the browser's local storage.

They are intentionally separate from:

- `localStorage` session payloads
- IndexedDB lab records
- internal persistence wrappers such as `PersistedPayload<T>`

## Artifact versions

- `ARTIFACT_SCHEMA_VERSION`
  - public file format version
  - current value: `a1`
- `SIM_RULESET_VERSION`
  - deterministic replay contract version
- `STORAGE_SCHEMA_VERSION`
  - internal browser persistence version only

These versions must stay decoupled. A storage migration must not silently change the public artifact contract.

## Supported artifact types

### Scenario artifact

Contains:

- artifact envelope metadata
- one normalized `ScenarioDefinition`

Import rules:

- validate envelope shape
- validate `artifactType === "scenario"`
- validate `artifactSchemaVersion`
- validate scenario payload shape
- show an import review before changing local state
- normalize scenario before hashing
- dedupe by `scenarioHash`
- never overwrite built-ins or existing custom scenarios silently
- if the imported scenario id already exists locally, assign a new local id

### Experiment artifact

Contains:

- artifact envelope metadata
- experiment name and note
- full deterministic `RunRecipe`
- compact `CompletedRunSummary`

Import rules:

- validate envelope shape
- validate `artifactType === "experiment"`
- validate `artifactSchemaVersion`
- validate recipe and summary payload shape
- show an import review before changing local state
- reject mismatched ruleset/storage contracts
- replay locally from the imported recipe
- compare regenerated `runHash` to the imported summary `runHash`
- reject if the hash does not match
- dedupe by `runHash`
- upsert the scenario locally by `scenarioHash` before saving the experiment record

## Security and trust posture

Artifact files are treated as untrusted input.

The app must:

- parse JSON only after file read succeeds
- reject unsupported or malformed payloads
- reject oversize files
- preview duplicate and compatibility outcomes before import confirmation
- reject replay mismatches
- avoid partial imports
- surface a clear user-facing notice for every success or failure

The app does not:

- execute imported code
- trust file extensions or the HTML `accept` attribute alone
- expose raw storage wrappers as a file format

## Why this exists

The local lab storage model is optimized for browser persistence.

The portable artifact model is optimized for:

- stability
- clarity
- replay trust
- future compatibility decisions

Those are different concerns. Keeping them separate avoids accidental long-term migration debt.
