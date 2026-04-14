import { Suspense, lazy, startTransition, useEffect, useState } from 'react'

import { APP_TITLE, PRESSURE_LABELS } from '@/domain/config'
import { buildAnalyticsNarrative, buildImportReviewSummary, getQuickstartStep } from '@/app/accessibility'
import type { ArtifactImportReview } from '@/domain/types'
import { PopulationCanvas } from '@/ui/canvas/PopulationCanvas'
import { ControlsPanel } from '@/ui/controls/ControlsPanel'
import { ComparisonPanel } from '@/ui/panels/ComparisonPanel'
import { AnalyticsNarrativePanel } from '@/ui/panels/AnalyticsNarrativePanel'
import { CreatureListPanel } from '@/ui/panels/CreatureListPanel'
import { ExampleArtifactsPanel } from '@/ui/panels/ExampleArtifactsPanel'
import { ImportReviewPanel } from '@/ui/panels/ImportReviewPanel'
import { InspectorPanel } from '@/ui/panels/InspectorPanel'
import { QuickstartPanel } from '@/ui/panels/QuickstartPanel'
import { ScenarioEventPanel } from '@/ui/panels/ScenarioEventPanel'
import { Timeline } from '@/ui/timeline/Timeline'

import { useSessionController } from './session'

const AnalyticsPanel = lazy(() =>
  import('@/ui/charts/AnalyticsPanel').then((module) => ({ default: module.AnalyticsPanel })),
)
const ScenarioEditorPanel = lazy(() =>
  import('@/ui/panels/ScenarioEditorPanel').then((module) => ({ default: module.ScenarioEditorPanel })),
)
const LabPanel = lazy(() =>
  import('@/ui/panels/LabPanel').then((module) => ({ default: module.LabPanel })),
)
const surfaceOrder = ['sandbox', 'scenarios', 'lab'] as const

export default function App() {
  const controller = useSessionController()
  const {
    state,
    selectedCreature,
    comparison,
    availableScenarios,
    editorScenario,
    baselineExperiment,
    comparisonEnabled,
  } = controller
  const selectedSnapshot = state.currentRun.snapshots[state.selectedGeneration] ?? state.currentRun.snapshots[0]
  const latestSnapshot = state.currentRun.snapshots.at(-1) ?? selectedSnapshot
  const activeScenario =
    availableScenarios.find((scenario) => scenario.id === state.selectedScenarioId) ?? availableScenarios[0]!
  const quickstartStep = getQuickstartStep({
    quickstart: state.quickstart,
    activeScenario,
    baselineExperiment,
    currentRunCompleted: state.currentRun.completed,
    compareMode: state.compareMode,
  })
  const analyticsNarrative = buildAnalyticsNarrative(state.currentRun.snapshots, state.selectedGeneration)
  const liveMessage = state.notice?.message ?? state.announcement?.message ?? ''
  const [analyticsReady, setAnalyticsReady] = useState(false)
  const [pendingImportReview, setPendingImportReview] = useState<{
    file: File
    review: ArtifactImportReview
  } | null>(null)

  useEffect(() => {
    if (state.surface !== 'sandbox' || analyticsReady) {
      return undefined
    }

    const revealAnalytics = () => {
      startTransition(() => {
        setAnalyticsReady(true)
      })
    }

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(revealAnalytics, { timeout: 700 })
      return () => window.cancelIdleCallback?.(idleId)
    }

    const timeoutId = globalThis.setTimeout(revealAnalytics, 220)
    return () => globalThis.clearTimeout(timeoutId)
  }, [analyticsReady, state.surface])

  if (!selectedSnapshot || !latestSnapshot || !activeScenario) {
    return null
  }

  function runQuickstartAction() {
    if (!quickstartStep) {
      return
    }

    switch (quickstartStep.action) {
      case 'loadBalancedWorld':
        controller.loadScenario('balanced-world')
        break
      case 'runCurrentScenario':
        controller.run()
        break
      case 'saveBaseline':
        void controller.saveExperiment()
        break
      case 'loadPredatorPulse':
        controller.loadScenario('predator-pulse')
        break
      case 'compareBaseline':
        controller.toggleCompare()
        break
      case 'openLab':
        controller.navigate('lab')
        break
      default:
        break
    }
  }

  async function handleScenarioImportSelection(file: File) {
    const review = await controller.reviewScenarioImport(file)
    if (review) {
      setPendingImportReview({ file, review })
      controller.navigate('scenarios')
    }
  }

  async function handleExperimentImportSelection(file: File) {
    const review = await controller.reviewExperimentImport(file)
    if (review) {
      setPendingImportReview({ file, review })
      controller.navigate('lab')
    }
  }

  function cancelImportReview() {
    const reviewKind = pendingImportReview?.review.kind
    setPendingImportReview(null)
    if (reviewKind) {
      window.requestAnimationFrame(() => {
        document.getElementById(reviewKind === 'scenario' ? 'scenario-import-trigger' : 'experiment-import-trigger')?.focus()
      })
    }
  }

  function confirmImportReview() {
    if (!pendingImportReview) {
      return
    }

    const { file, review } = pendingImportReview
    setPendingImportReview(null)

    if (!review.canImport) {
      window.requestAnimationFrame(() => {
        document.getElementById(review.kind === 'scenario' ? 'scenario-import-trigger' : 'experiment-import-trigger')?.focus()
      })
      return
    }

    if (review.kind === 'scenario') {
      void controller.importScenario(file).finally(() => {
        window.requestAnimationFrame(() => {
          document.getElementById('scenario-import-trigger')?.focus()
        })
      })
      return
    }

    void controller.importExperiment(file).finally(() => {
      window.requestAnimationFrame(() => {
        document.getElementById('experiment-import-trigger')?.focus()
      })
    })
  }

  function focusSurfaceTab(surface: (typeof surfaceOrder)[number]) {
    controller.navigate(surface)
    window.requestAnimationFrame(() => {
      document.getElementById(`tab-${surface}`)?.focus()
    })
  }

  function handleSurfaceTabKeyDown(currentSurface: typeof surfaceOrder[number], direction: 1 | -1) {
    const currentIndex = surfaceOrder.indexOf(currentSurface)
    const nextSurface = surfaceOrder[(currentIndex + direction + surfaceOrder.length) % surfaceOrder.length]!
    focusSurfaceTab(nextSurface)
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" key={state.announcement?.id ?? liveMessage}>
        {liveMessage}
      </div>

      <header className="topbar">
        <div className="topbar__brand">
          <p className="eyebrow">Local experiment lab</p>
          <h1>{APP_TITLE}</h1>
          <p className="topbar__subtitle">
            Change one world variable, replay it deterministically, and see exactly how the population adapts.
          </p>
        </div>

        <div className="topbar__controls">
          <div className="toolbar-group toolbar-group--nav">
            <div className="surface-nav" role="tablist" aria-label="Workspace surfaces">
              <button
                type="button"
                id="tab-sandbox"
                role="tab"
                tabIndex={state.surface === 'sandbox' ? 0 : -1}
                aria-selected={state.surface === 'sandbox'}
                aria-controls="sandbox-panel"
                className={`button button--ghost ${state.surface === 'sandbox' ? 'button--active' : ''}`}
                onClick={() => controller.navigate('sandbox')}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    handleSurfaceTabKeyDown('sandbox', 1)
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    handleSurfaceTabKeyDown('sandbox', -1)
                  } else if (event.key === 'End') {
                    event.preventDefault()
                    focusSurfaceTab('lab')
                  } else if (event.key === 'Home') {
                    event.preventDefault()
                    focusSurfaceTab('sandbox')
                  }
                }}
              >
                Sandbox
              </button>
              <button
                type="button"
                id="tab-scenarios"
                role="tab"
                tabIndex={state.surface === 'scenarios' ? 0 : -1}
                aria-selected={state.surface === 'scenarios'}
                aria-controls="scenarios-panel"
                className={`button button--ghost ${state.surface === 'scenarios' ? 'button--active' : ''}`}
                onClick={() => controller.navigate('scenarios')}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    handleSurfaceTabKeyDown('scenarios', 1)
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    handleSurfaceTabKeyDown('scenarios', -1)
                  } else if (event.key === 'End') {
                    event.preventDefault()
                    focusSurfaceTab('lab')
                  } else if (event.key === 'Home') {
                    event.preventDefault()
                    focusSurfaceTab('sandbox')
                  }
                }}
              >
                Scenarios
              </button>
              <button
                type="button"
                id="tab-lab"
                role="tab"
                tabIndex={state.surface === 'lab' ? 0 : -1}
                aria-selected={state.surface === 'lab'}
                aria-controls="lab-panel"
                className={`button button--ghost ${state.surface === 'lab' ? 'button--active' : ''}`}
                onClick={() => controller.navigate('lab')}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    handleSurfaceTabKeyDown('lab', 1)
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    handleSurfaceTabKeyDown('lab', -1)
                  } else if (event.key === 'End') {
                    event.preventDefault()
                    focusSurfaceTab('lab')
                  } else if (event.key === 'Home') {
                    event.preventDefault()
                    focusSurfaceTab('sandbox')
                  }
                }}
              >
                Lab
              </button>
            </div>
          </div>

          <div className="toolbar-group">
            <label className="field field--compact">
              <span>Scenario</span>
              <select value={state.selectedScenarioId} onChange={(event) => controller.loadScenario(event.target.value)}>
                {availableScenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="seed-card" data-testid="seed-display">
              <span>Seed</span>
              <strong>{state.config.seed}</strong>
            </div>

            <button
              type="button"
              className="button button--ghost"
              onClick={controller.reseed}
            >
              Reseed
            </button>
          </div>

          <div className="toolbar-group">
            <button
              type="button"
              className="button"
              onClick={state.runStatus === 'running' ? controller.pause : controller.run}
              disabled={state.currentRun.completed}
            >
              {state.runStatus === 'running' ? 'Pause' : 'Run'}
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={controller.step}
              disabled={state.runStatus === 'running' || state.currentRun.completed}
            >
              Step
            </button>
            <button
              type="button"
              className={`button button--ghost ${state.fastForward ? 'button--active' : ''}`}
              onClick={controller.toggleFastForward}
            >
              Fast-forward
            </button>
            <button type="button" className="button button--ghost" onClick={controller.reset}>
              Reset
            </button>
          </div>

          <div className="toolbar-group">
            <button
              type="button"
              className="button"
              onClick={() => void controller.saveExperiment()}
              disabled={!state.currentRun.completedSummary}
            >
              Save Experiment
            </button>
            <button type="button" className="button button--ghost" onClick={() => controller.navigate('lab')}>
              Open Lab
            </button>
            <button
              type="button"
              className={`button button--ghost ${state.compareMode ? 'button--active' : ''}`}
              onClick={controller.toggleCompare}
              disabled={!comparisonEnabled}
            >
              Compare baseline
            </button>
          </div>
        </div>
      </header>

      {state.notice ? (
        <aside className={`notice notice--${state.notice.level}`}>
          <span>{state.notice.message}</span>
          <button type="button" onClick={controller.dismissNotice}>
            Dismiss
          </button>
        </aside>
      ) : null}

      {pendingImportReview ? (
        <aside className="import-review-banner">
          <ImportReviewPanel
            review={pendingImportReview.review}
            onConfirm={confirmImportReview}
            onCancel={cancelImportReview}
          />
        </aside>
      ) : null}

      {state.surface === 'sandbox' ? (
        <>
          <section className="workspace-banner" id="sandbox-panel" role="tabpanel" aria-labelledby="tab-sandbox">
            <div className="workspace-banner__copy">
              <p className="eyebrow">Active Workspace</p>
              <h2>{activeScenario.name}</h2>
              <p className="muted">
                Scrub one generation at a time, compare against a saved baseline, and use the right rail to understand why
                the population moved.
              </p>
            </div>
            <div className="workspace-banner__metrics">
              <div className="workspace-stat">
                <span>Run state</span>
                <strong>{state.currentRun.completed ? 'Complete' : state.runStatus === 'running' ? 'Running' : 'Ready'}</strong>
              </div>
              <div className="workspace-stat">
                <span>Selected generation</span>
                <strong>g{selectedSnapshot.generationIndex}</strong>
              </div>
              <div className="workspace-stat">
                <span>Baseline</span>
                <strong>{baselineExperiment ? baselineExperiment.name : 'None selected'}</strong>
              </div>
            </div>
          </section>

          <main className="layout" role="main" id="main-content" tabIndex={-1}>
            <aside className="layout__left" aria-label="Scenario controls and guidance">
              <ControlsPanel config={state.config} onChange={controller.setConfigField} />
              <section className="panel">
                <div className="panel__header">
                  <p className="eyebrow">Scenario Notes</p>
                  <h2>{activeScenario.name}</h2>
                  <p className="muted">{activeScenario.description}</p>
                </div>
                <ul className="bullet-list">
                  {(Object.entries(PRESSURE_LABELS) as Array<[keyof typeof PRESSURE_LABELS, string]>).map(([key, label]) => (
                    <li key={key}>
                      {label}: {Math.round(state.config[key] * 100)}%
                    </li>
                  ))}
                </ul>
                <p className="muted">
                  Sandbox controls change the active experiment only. Edit reusable scenario defaults in the Scenarios view.
                </p>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <p className="eyebrow">Baseline</p>
                  <h2>{baselineExperiment ? baselineExperiment.name : 'No baseline selected'}</h2>
                  <p className="muted">
                    {baselineExperiment
                      ? `${baselineExperiment.recipe.scenario.name} · seed ${baselineExperiment.recipe.seed}`
                      : 'Open the lab and mark an experiment as the baseline to unlock comparison.'}
                  </p>
                </div>
              </section>

              <QuickstartPanel
                step={quickstartStep}
                onAction={runQuickstartAction}
                onDismiss={controller.dismissQuickstart}
              />
              <AnalyticsNarrativePanel lines={analyticsNarrative} />
            </aside>

            <section className="layout__center">
              <PopulationCanvas
                snapshot={selectedSnapshot}
                selectedCreatureId={state.selectedCreatureId}
                onSelectCreature={controller.setSelectedCreature}
              />
              <Timeline
                snapshots={state.currentRun.snapshots}
                selectedGeneration={state.selectedGeneration}
                onChange={controller.setSelectedGeneration}
              />
            </section>

            <aside className="layout__right" aria-label="Inspector and analysis">
              <ComparisonPanel comparison={state.compareMode ? comparison : null} />

              <section className="panel">
                <div className="panel__header">
                  <p className="eyebrow">Generation Summary</p>
                  <h2>Why the population moved</h2>
                  <p className="muted">
                    Snapshot {selectedSnapshot.generationIndex} is aligned across the charts, timeline, canvas, and inspector.
                  </p>
                </div>
                <ul className="bullet-list" data-testid="summary-lines">
                  {selectedSnapshot.summaryText.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <div className="metric-grid">
                  <div className="metric-card">
                    <span>Selected population</span>
                    <strong data-testid="population-size">{selectedSnapshot.populationSize}</strong>
                  </div>
                  <div className="metric-card">
                    <span>Selected survival</span>
                    <strong>{Math.round(selectedSnapshot.survivalRate * 100)}%</strong>
                  </div>
                  <div className="metric-card metric-card--wide">
                    <span>Latest generation reached</span>
                    <strong>
                      {latestSnapshot.generationIndex}
                      {state.currentRun.completed ? ' (run complete)' : ' so far'}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <p className="eyebrow">Diversity</p>
                  <h2>How narrow the population is</h2>
                </div>
                <div className="metric-grid">
                  <div className="metric-card">
                    <span>Diversity score</span>
                    <strong>{Math.round(selectedSnapshot.diversityScore * 100)}%</strong>
                  </div>
                  <div className="metric-card">
                    <span>Dominant phenotype</span>
                    <strong>{Math.round(selectedSnapshot.dominantPhenotypeShare * 100)}%</strong>
                  </div>
                  <div className="metric-card metric-card--wide">
                    <span>Phenotype buckets represented</span>
                    <strong>{selectedSnapshot.phenotypeBucketCount}</strong>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <p className="eyebrow">Pressure Impact</p>
                  <h2>What mattered most</h2>
                </div>
                <ol className="rank-list">
                  {selectedSnapshot.pressureImpact.ranking.map((entry) => (
                    <li key={entry.pressure}>
                      <span>{PRESSURE_LABELS[entry.pressure]}</span>
                      <strong>{Math.round(entry.intensity * 100)} impact</strong>
                    </li>
                  ))}
                </ol>
              </section>

              <ScenarioEventPanel snapshot={selectedSnapshot} />

              <CreatureListPanel
                creatures={selectedSnapshot.creatures}
                selectedCreatureId={state.selectedCreatureId}
                onSelectCreature={controller.setSelectedCreature}
              />

              <InspectorPanel creature={selectedCreature} />
            </aside>
          </main>

          <section className="analytics-strip">
            {analyticsReady ? (
              <Suspense fallback={<section className="panel">Loading analytics…</section>}>
                <AnalyticsPanel
                  snapshots={state.currentRun.snapshots}
                  selectedSnapshot={selectedSnapshot}
                  previousRun={baselineExperiment?.completedSummary ?? null}
                  compareMode={state.compareMode}
                />
              </Suspense>
            ) : (
              <section className="panel analytics-pending">
                <div className="panel__header">
                  <p className="eyebrow">Analytics</p>
                  <h2>Charts load after the workspace is ready</h2>
                  <p className="muted">
                    The simulation surface renders first so the sandbox feels faster on a cold visit.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() =>
                    startTransition(() => {
                      setAnalyticsReady(true)
                    })
                  }
                >
                  Load analytics now
                </button>
              </section>
            )}
          </section>
        </>
      ) : null}

      {state.surface === 'scenarios' ? (
        <main className="surface-layout" id="scenarios-panel" role="tabpanel" aria-labelledby="tab-scenarios" tabIndex={-1}>
          <section className="workspace-banner workspace-banner--surface">
            <div className="workspace-banner__copy">
              <p className="eyebrow">Scenario Studio</p>
              <h2>Design staged worlds</h2>
              <p className="muted">
                Keep the reusable scenario recipe clean here, then load it into the sandbox when you want to run experiments.
              </p>
            </div>
          </section>
          <section className="workspace-banner workspace-banner--surface">
            <div className="workspace-banner__copy">
              <p className="eyebrow">Share Flow</p>
              <h2>Review imports before they touch local state</h2>
              <p className="muted">
                Every import now gets a preview step first, so you can see whether the file will add a scenario, reuse a local match, or warn about compatibility.
              </p>
            </div>
          </section>
          <ExampleArtifactsPanel
            onDownloadScenarioExample={(scenarioId) => void controller.exportScenario(scenarioId)}
            onDownloadExperimentExample={(scenarioId) => void controller.exportExampleExperiment(scenarioId)}
          />
          <Suspense fallback={<section className="panel">Loading scenario studio…</section>}>
            <ScenarioEditorPanel
              builtInScenarios={availableScenarios.filter((scenario) => scenario.isBuiltIn)}
              customScenarios={availableScenarios.filter((scenario) => !scenario.isBuiltIn)}
              editorScenario={editorScenario}
              onSelectScenario={controller.selectEditorScenario}
              onCreateScenario={() => void controller.createScenario()}
              onDuplicateScenario={(scenarioId) => void controller.duplicateScenario(scenarioId)}
              onDeleteScenario={(scenarioId) => void controller.deleteScenario(scenarioId)}
              onLoadIntoSandbox={controller.loadEditorIntoSandbox}
              onUpdateField={(field, value) => void controller.updateEditorField(field, value)}
              onUpdateConfigField={(field, value) => void controller.updateEditorConfigField(field, value)}
              onAddEvent={() => void controller.addEditorEvent()}
              onUpdateEvent={(eventId, update) => void controller.updateEditorEvent(eventId, update)}
              onSetPressureOverride={(eventId, pressure, value) =>
                void controller.setEditorEventPressureOverride(eventId, pressure, value)
              }
              onDeleteEvent={(eventId) => void controller.deleteEditorEvent(eventId)}
              onExportScenario={(scenarioId) => void controller.exportScenario(scenarioId)}
              onImportScenario={(file) => void handleScenarioImportSelection(file)}
            />
          </Suspense>
        </main>
      ) : null}

      {state.surface === 'lab' ? (
        <main className="surface-layout" id="lab-panel" role="tabpanel" aria-labelledby="tab-lab" tabIndex={-1}>
          <section className="workspace-banner workspace-banner--surface">
            <div className="workspace-banner__copy">
              <p className="eyebrow">Experiment Library</p>
              <h2>Reopen, compare, and keep the best runs</h2>
              <p className="muted">
                The lab stores recipes, not giant archives, so every saved experiment can be reconstructed and trusted.
              </p>
            </div>
          </section>
          <section className="workspace-banner workspace-banner--surface">
            <div className="workspace-banner__copy">
              <p className="eyebrow">Portable Artifacts</p>
              <h2>{pendingImportReview ? pendingImportReview.review.title : 'Export or import with confidence'}</h2>
              <p className="muted">
                {pendingImportReview
                  ? buildImportReviewSummary(pendingImportReview.review)
                  : 'Use the review step to confirm what a file will do before it enters the local lab or scenario library.'}
              </p>
            </div>
          </section>
          <ExampleArtifactsPanel
            onDownloadScenarioExample={(scenarioId) => void controller.exportScenario(scenarioId)}
            onDownloadExperimentExample={(scenarioId) => void controller.exportExampleExperiment(scenarioId)}
          />
          <Suspense fallback={<section className="panel">Loading experiment library…</section>}>
            <LabPanel
              experiments={state.savedExperiments}
              baselineExperimentId={state.baselineExperimentId}
              sort={state.labSort}
              onSetSort={controller.setLabSort}
              onSetBaseline={controller.setBaselineExperiment}
              onOpenExperiment={(experimentId) => void controller.openExperiment(experimentId)}
              onUpdateExperiment={(experimentId, patch) => void controller.updateExperiment(experimentId, patch)}
              onDeleteExperiment={(experimentId) => void controller.deleteExperiment(experimentId)}
              onExportExperiment={(experimentId) => void controller.exportExperiment(experimentId)}
              onImportExperiment={(file) => void handleExperimentImportSelection(file)}
            />
          </Suspense>
        </main>
      ) : null}
    </div>
  )
}
