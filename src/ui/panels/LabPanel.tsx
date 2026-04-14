import { useRef } from 'react'

import type { SavedExperiment } from '@/domain/types'

export function LabPanel({
  experiments,
  baselineExperimentId,
  sort,
  onSetSort,
  onSetBaseline,
  onOpenExperiment,
  onUpdateExperiment,
  onDeleteExperiment,
  onExportExperiment,
  onImportExperiment,
}: {
  experiments: SavedExperiment[]
  baselineExperimentId: string | null
  sort: 'updated' | 'oldest' | 'population'
  onSetSort: (sort: 'updated' | 'oldest' | 'population') => void
  onSetBaseline: (experimentId: string | null) => void
  onOpenExperiment: (experimentId: string) => void
  onUpdateExperiment: (experimentId: string, patch: Partial<Pick<SavedExperiment, 'name' | 'note'>>) => void
  onDeleteExperiment: (experimentId: string) => void
  onExportExperiment: (experimentId: string) => void
  onImportExperiment: (file: File) => void
}) {
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <section className="panel">
      <div className="panel__header">
        <p className="eyebrow">Local Lab</p>
        <h2>Saved experiments</h2>
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
  )
}
