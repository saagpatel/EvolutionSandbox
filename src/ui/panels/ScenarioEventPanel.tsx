import { PRESSURE_LABELS } from '@/domain/config'
import type { GenerationSnapshot } from '@/domain/types'

export function ScenarioEventPanel({ snapshot }: { snapshot: GenerationSnapshot }) {
  if (!snapshot.activeScenarioEvent) {
    return null
  }

  const triggeredNow = snapshot.triggeredScenarioEvent?.id === snapshot.activeScenarioEvent.id

  return (
    <section className="panel">
      <div className="panel__header">
        <p className="eyebrow">Active Scenario Event</p>
        <h2>{snapshot.activeScenarioEvent.label}</h2>
        <p className="muted">
          {triggeredNow
            ? `This event starts on generation ${snapshot.activeScenarioEvent.generationIndex}. ${snapshot.activeScenarioEvent.description}`
            : `This event has been shaping the world since generation ${snapshot.activeScenarioEvent.generationIndex}. ${snapshot.activeScenarioEvent.description}`}
        </p>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Started at generation</span>
          <strong>{snapshot.activeScenarioEvent.generationIndex}</strong>
        </div>
        <div className="metric-card">
          <span>Overrides</span>
          <strong>{Object.keys(snapshot.activeScenarioEvent.pressureOverrides).length}</strong>
        </div>
      </div>

      <ul className="rank-list">
        {Object.entries(snapshot.activeScenarioEvent.pressureOverrides).map(([pressure, value]) => (
          <li key={pressure}>
            <span>{PRESSURE_LABELS[pressure as keyof typeof PRESSURE_LABELS]}</span>
            <strong>{Math.round((value ?? 0) * 100)}%</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}
