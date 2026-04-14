import { PRESSURE_LABELS, toPercent } from '@/domain/config'
import { useRef } from 'react'
import type { ScenarioDefinition, ScenarioEvent } from '@/domain/types'
import { ControlsPanel } from '@/ui/controls/ControlsPanel'

function overrideEntries(event: ScenarioEvent) {
  return Object.entries(PRESSURE_LABELS).map(([pressure, label]) => ({
    pressure,
    label,
    enabled: typeof event.pressureOverrides[pressure as keyof typeof event.pressureOverrides] === 'number',
    value: event.pressureOverrides[pressure as keyof typeof event.pressureOverrides] ?? 0.5,
  }))
}

export function ScenarioEditorPanel({
  builtInScenarios,
  customScenarios,
  editorScenario,
  onSelectScenario,
  onCreateScenario,
  onDuplicateScenario,
  onDeleteScenario,
  onLoadIntoSandbox,
  onUpdateField,
  onUpdateConfigField,
  onAddEvent,
  onUpdateEvent,
  onSetPressureOverride,
  onDeleteEvent,
  onExportScenario,
  onImportScenario,
}: {
  builtInScenarios: ScenarioDefinition[]
  customScenarios: ScenarioDefinition[]
  editorScenario: ScenarioDefinition
  onSelectScenario: (scenarioId: string) => void
  onCreateScenario: () => void
  onDuplicateScenario: (scenarioId: string) => void
  onDeleteScenario: (scenarioId: string) => void
  onLoadIntoSandbox: () => void
  onUpdateField: (field: 'name' | 'description', value: string) => void
  onUpdateConfigField: (field: 'foodScarcity' | 'predationPressure' | 'coldStress' | 'habitatVisibility' | 'mutationRate' | 'startingPopulation' | 'generationTarget', value: number) => void
  onAddEvent: () => void
  onUpdateEvent: (eventId: string, update: Partial<ScenarioEvent>) => void
  onSetPressureOverride: (eventId: string, pressure: keyof ScenarioEvent['pressureOverrides'], value: number | null) => void
  onDeleteEvent: (eventId: string) => void
  onExportScenario: (scenarioId: string) => void
  onImportScenario: (file: File) => void
}) {
  const importInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="surface-grid surface-grid--wide">
      <section className="panel">
        <div className="panel__header">
          <p className="eyebrow">Scenario Library</p>
          <h2>Starter and custom scenarios</h2>
          <p className="muted">Built-ins are read-only. Duplicate one or create a custom scenario to edit it.</p>
        </div>

        <div className="stack-actions">
          <button type="button" className="button" onClick={onCreateScenario}>
            New scenario
          </button>
          <button
            id="scenario-import-trigger"
            type="button"
            className="button button--ghost"
            onClick={() => importInputRef.current?.click()}
          >
            Import scenario
          </button>
          <input
            ref={importInputRef}
            className="sr-only"
            type="file"
            aria-label="Choose scenario file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                onImportScenario(file)
              }
              event.target.value = ''
            }}
          />
        </div>

        <div className="scenario-list-block">
          <h3>Built-in</h3>
          <ul className="scenario-list">
            {builtInScenarios.map((scenario) => (
              <li key={scenario.id}>
                <button
                  type="button"
                  className={`scenario-pill ${editorScenario.id === scenario.id ? 'scenario-pill--active' : ''}`}
                  onClick={() => onSelectScenario(scenario.id)}
                >
                  <span className="scenario-pill__title">{scenario.name}</span>
                  <span className="scenario-pill__meta">{scenario.description}</span>
                  <strong>{scenario.events.length} events</strong>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="scenario-list-block">
          <h3>Custom</h3>
          <ul className="scenario-list">
            {customScenarios.length > 0 ? (
              customScenarios.map((scenario) => (
                <li key={scenario.id}>
                  <button
                    type="button"
                    className={`scenario-pill ${editorScenario.id === scenario.id ? 'scenario-pill--active' : ''}`}
                    onClick={() => onSelectScenario(scenario.id)}
                  >
                    <span className="scenario-pill__title">{scenario.name}</span>
                    <span className="scenario-pill__meta">{scenario.description}</span>
                    <strong>{scenario.events.length} events</strong>
                  </button>
                </li>
              ))
            ) : (
              <li className="muted">No custom scenarios yet. Import one or duplicate a built-in scenario to start editing.</li>
            )}
          </ul>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <p className="eyebrow">Scenario Editor</p>
          <h2>{editorScenario.name}</h2>
          <p className="muted">
            {editorScenario.isBuiltIn
              ? 'This is a built-in scenario. Duplicate it before editing.'
              : 'Changes save into the local lab automatically.'}
          </p>
        </div>

        <div className="stack-actions stack-actions--wrap">
          <button type="button" className="button" onClick={() => onDuplicateScenario(editorScenario.id)}>
            Duplicate
          </button>
          <button type="button" className="button button--ghost" onClick={() => onExportScenario(editorScenario.id)}>
            Export scenario
          </button>
          {!editorScenario.isBuiltIn ? (
            <button type="button" className="button button--ghost" onClick={() => onDeleteScenario(editorScenario.id)}>
              Delete
            </button>
          ) : null}
          <button type="button" className="button button--ghost" onClick={onLoadIntoSandbox}>
            Load into sandbox
          </button>
        </div>

        <label className="control-row">
          <div className="control-row__header">
            <span>Name</span>
          </div>
          <input
            type="text"
            value={editorScenario.name}
            disabled={editorScenario.isBuiltIn}
            onChange={(event) => onUpdateField('name', event.target.value)}
          />
        </label>

        <label className="control-row">
          <div className="control-row__header">
            <span>Description</span>
          </div>
          <textarea
            rows={3}
            value={editorScenario.description}
            disabled={editorScenario.isBuiltIn}
            onChange={(event) => onUpdateField('description', event.target.value)}
          />
        </label>

        <ControlsPanel
          config={editorScenario.baseConfig}
          disabled={editorScenario.isBuiltIn}
          onChange={onUpdateConfigField}
        />

        <section className="panel panel--subtle">
          <div className="panel__header">
            <p className="eyebrow">Scheduled Changes</p>
            <h2>Event script</h2>
            <p className="muted">Events take over from their generation onward until a later event overrides them.</p>
          </div>

          <div className="stack-actions">
            <button
              type="button"
              className="button"
              disabled={editorScenario.isBuiltIn || editorScenario.events.length >= 6}
              onClick={onAddEvent}
            >
              Add event
            </button>
          </div>

          <div className="event-list">
            {editorScenario.events.length > 0 ? (
              editorScenario.events.map((event) => (
                <article key={event.id} className="event-card">
                  <div className="event-card__header">
                    <strong>Generation {event.generationIndex}</strong>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      disabled={editorScenario.isBuiltIn}
                      onClick={() => onDeleteEvent(event.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <label className="control-row">
                    <div className="control-row__header">
                      <span>Generation</span>
                      <strong>{event.generationIndex}</strong>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={editorScenario.baseConfig.generationTarget}
                      step={1}
                      value={event.generationIndex}
                      disabled={editorScenario.isBuiltIn}
                      onChange={(changeEvent) =>
                        onUpdateEvent(event.id, { generationIndex: Number(changeEvent.target.value) })
                      }
                    />
                  </label>

                  <label className="control-row">
                    <div className="control-row__header">
                      <span>Label</span>
                    </div>
                    <input
                      type="text"
                      value={event.label}
                      disabled={editorScenario.isBuiltIn}
                      onChange={(changeEvent) => onUpdateEvent(event.id, { label: changeEvent.target.value })}
                    />
                  </label>

                  <label className="control-row">
                    <div className="control-row__header">
                      <span>Description</span>
                    </div>
                    <textarea
                      rows={2}
                      value={event.description}
                      disabled={editorScenario.isBuiltIn}
                      onChange={(changeEvent) => onUpdateEvent(event.id, { description: changeEvent.target.value })}
                    />
                  </label>

                  <div className="event-overrides">
                    {overrideEntries(event).map((entry) => (
                      <label key={entry.pressure} className="override-row">
                        <div className="override-row__header">
                          <span>{entry.label}</span>
                          <input
                            type="checkbox"
                            checked={entry.enabled}
                            disabled={editorScenario.isBuiltIn}
                            onChange={(changeEvent) =>
                              onSetPressureOverride(
                                event.id,
                                entry.pressure as keyof ScenarioEvent['pressureOverrides'],
                                changeEvent.target.checked ? entry.value : null,
                              )
                            }
                          />
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={toPercent(entry.value)}
                          disabled={editorScenario.isBuiltIn || !entry.enabled}
                          onChange={(changeEvent) =>
                            onSetPressureOverride(
                              event.id,
                              entry.pressure as keyof ScenarioEvent['pressureOverrides'],
                              Number(changeEvent.target.value) / 100,
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">No scheduled changes yet. Add an event to create a staged scenario.</p>
            )}
          </div>
        </section>
      </section>
    </div>
  )
}
