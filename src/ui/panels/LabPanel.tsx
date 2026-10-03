import { useRef, useState } from 'react'

import type { LabQuarantineSummary, SavedExperiment } from '@/domain/types'

export function LabPanel({
  experiments,
  baselineExperimentId,
  sort,
  quarantine,
  onSetSort,
  onSetBaseline,
  onOpenExperiment,
  onUpdateExperiment,
  onDeleteExperiment,
  onExportExperiment,
  onImportExperiment,
  onRestoreQuarantine,
  onExportQuarantine,
  onClearQuarantine,
}: {
  experiments: SavedExperiment[]
  baselineExperimentId: string | null
  sort: 'updated' | 'oldest' | 'population'
  quarantine: LabQuarantineSummary[]
  onSetSort: (sort: 'updated' | 'oldest' | 'population') => void
  onSetBaseline: (experimentId: string | null) => void
  onOpenExperiment: (experimentId: string) => void
  onUpdateExperiment: (experimentId: string, patch: Partial<Pick<SavedExperiment, 'name' | 'note'>>) => void
  onDeleteExperiment: (experimentId: string) => void
  onExportExperiment: (experimentId: string) => void
  onImportExperiment: (file: File) => void
  onRestoreQuarantine: (quarantineId: string) => void
  onExportQuarantine: () => void
  onClearQuarantine: () => void
}) {
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const clearTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  function cancelClear() {
    setConfirmingClear(false)
    window.requestAnimationFrame(() => {
      clearTriggerRef.current?.focus()
    })
  }

  function confirmClear() {
    setConfirmingClear(false)
    onClearQuarantine()
    window.requestAnimationFrame(() => {
      document.getElementById('lab-experiments-heading')?.focus()
    })
  }

  return (
    <>
      {quarantine.length > 0 ? (
        <section className="panel" data-testid="lab-recovery" aria-labelledby="lab-recovery-heading">
          <div className="panel__header">
            <p className="eyebrow">Local recovery</p>
            <h2 id="lab-recovery-heading">Incompatible lab records</h2>
            <p className="muted">
              {quarantine.length === 1
                ? '1 incompatible record is held locally so it can be restored or exported. Raw payloads stay out of this list.'
                : `${quarantine.length} incompatible records are held locally so they can be restored or exported. Raw payloads stay out of this list.`}
            </p>
          </div>

          <div className="metric-grid">
            <div className="metric-card">
              <span>Held records</span>
              <strong>{quarantine.length}</strong>
            </div>
          </div>

          <div className="stack-actions stack-actions--wrap">
            <button type="button" className="button button--ghost" onClick={onExportQuarantine}>
              Export recovery data
            </button>
            <button
              id="lab-recovery-clear-trigger"
              ref={clearTriggerRef}
              type="button"
              className="button button--ghost"
              onClick={() => setConfirmingClear(true)}
            >
              Clear recovery records
            </button>
            {confirmingClear ? (
              <>
                <button type="button" className="button" onClick={confirmClear} autoFocus>
                  Confirm clear recovery records
                </button>
                <button type="button" className="button button--ghost" onClick={cancelClear}>
                  Cancel clear
                </button>
              </>
            ) : null}
          </div>

          {confirmingClear ? (
            <p className="muted" role="status">
              Clearing removes local recovery copies only. Saved experiments and custom scenarios stay in the lab.
            </p>
          ) : null}

          <ul className="lab-list lab-list--recovery" role="list">
            {quarantine.map((entry) => (
              <li key={entry.id}>
                <article className="lab-card lab-card--recovery">
                  <div className="lab-card__header">
                    <div>
                      <p className="eyebrow">{entry.kind}</p>
                      <strong>{entry.originalKey}</strong>
                    </div>
                    <span className="lab-card__seed">{entry.kind} record</span>
                  </div>
                  <div className="lab-card__meta">
                    <span>schema {entry.observedSchemaVersion ?? 'unknown'}</span>
                    <span>ruleset {entry.observedRulesetVersion ?? 'unknown'}</span>
                  </div>
                  <div className="lab-card__meta">
                    <span>quarantined {dateFormatter.format(new Date(entry.quarantinedAt))}</span>
                    {entry.originalSavedAt ? (
                      <span>saved {dateFormatter.format(new Date(entry.originalSavedAt))}</span>
                    ) : (
                      <span>original save time unavailable</span>
                    )}
                  </div>
                  <p>{entry.reason}</p>
                  <div className="stack-actions stack-actions--wrap">
                    <button
                      type="button"
                      className="button"
                      onClick={() => onRestoreQuarantine(entry.id)}
                    >
                      Restore {entry.kind} {entry.originalKey}
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <p className="eyebrow">Local Lab</p>
          <h2 id="lab-experiments-heading" tabIndex={-1}>
            Saved experiments
          </h2>
          <p className="muted">Keep the strongest outcomes, reopen them deterministically, and choose one as the active baseline.</p>
        </div>

        <label className="field">
          <span>Sort experiments</span>
          <select value={sort} onChange={(event) => onSetSort(event.target.value as typeof sort)}>
            <option value="updated">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="population">Highest final population</option>
          </select>
        </label>

        <div className="stack-actions stack-actions--wrap">
          <button
            id="experiment-import-trigger"
            type="button"
            className="button button--ghost"
            onClick={() => importInputRef.current?.click()}
          >
            Import experiment
          </button>
          <input
            ref={importInputRef}
            className="sr-only"
            type="file"
            aria-label="Choose experiment file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                onImportExperiment(file)
              }
              event.target.value = ''
            }}
          />
        </div>

        <div className="lab-list">
          {experiments.length > 0 ? (
            experiments.map((experiment) => {
              const isBaseline = baselineExperimentId === experiment.id
              return (
                <article key={experiment.id} className={`lab-card ${isBaseline ? 'lab-card--active' : ''}`}>
                  <div className="lab-card__header">
                    <div>
                      <p className="eyebrow">Scenario</p>
                      <strong>{experiment.name}</strong>
                    </div>
                    <span className="lab-card__seed">seed {experiment.recipe.seed}</span>
                  </div>
                  <div className="lab-card__meta">
                    <span>{experiment.recipe.scenario.name}</span>
                    <span>updated {dateFormatter.format(new Date(experiment.updatedAt))}</span>
                  </div>

                  <label className="control-row">
                    <div className="control-row__header">
                      <span>Experiment name</span>
                    </div>
                    <input
                      type="text"
                      value={experiment.name}
                      onChange={(event) => onUpdateExperiment(experiment.id, { name: event.target.value })}
                    />
                  </label>

                  <label className="control-row">
                    <div className="control-row__header">
                      <span>Notes</span>
                    </div>
                    <textarea
                      rows={2}
                      value={experiment.note}
                      onChange={(event) => onUpdateExperiment(experiment.id, { note: event.target.value })}
                    />
                  </label>

                  <div className="metric-grid">
                    <div className="metric-card">
                      <span>Final population</span>
                      <strong>{experiment.completedSummary.finalPopulationSize}</strong>
                    </div>
                    <div className="metric-card">
                      <span>Final generation</span>
                      <strong>{experiment.completedSummary.finalGeneration}</strong>
                    </div>
                  </div>

                  <div className="stack-actions stack-actions--wrap">
                    <button type="button" className="button" onClick={() => onOpenExperiment(experiment.id)}>
                      Reopen
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => onExportExperiment(experiment.id)}
                    >
                      Export
                    </button>
                    <button
                      type="button"
                      className={`button button--ghost ${isBaseline ? 'button--active' : ''}`}
                      onClick={() => onSetBaseline(isBaseline ? null : experiment.id)}
                    >
                      {isBaseline ? 'Clear baseline' : 'Use as baseline'}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => onDeleteExperiment(experiment.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              )
            })
          ) : (
            <p className="muted">
              No saved experiments yet. Complete a run in the sandbox, or use the portable examples above to try an import first.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
