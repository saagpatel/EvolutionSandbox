import { describeCreaturePosition } from '@/app/accessibility'
import { PRESSURE_LABELS, TRAIT_LABELS } from '@/domain/config'
import type { Creature } from '@/domain/types'

function strongestPressure(creature: Creature, mode: 'help' | 'hurt'): string {
  const entries = Object.entries(creature.pressureEffects)
  const sorted = [...entries].sort((left, right) =>
    mode === 'help' ? right[1] - left[1] : left[1] - right[1],
  )
  const winner = sorted[0]
  return winner ? PRESSURE_LABELS[winner[0] as keyof typeof PRESSURE_LABELS] : 'None'
}

export function InspectorPanel({ creature }: { creature: Creature | null }) {
  const pressureBreakdown = creature
    ? (Object.entries(creature.pressureEffects) as Array<[keyof typeof PRESSURE_LABELS, number]>).sort(
        (left, right) => right[1] - left[1],
      )
    : []

  return (
    <section className="panel">
      <div className="panel__header">
        <p className="eyebrow">Inspector</p>
        <h2>{creature ? `Creature ${creature.id}` : 'Hover or click a creature'}</h2>
        <p className="muted">
          {creature
            ? 'The inspector explains why one organism is thriving or struggling.'
            : 'Use the sprite field to inspect trait values and pressure fit.'}
        </p>
      </div>

      {creature ? (
        <div className="inspector-grid">
          {(
            [
              ['size', creature.size],
              ['speed', creature.speed],
              ['camouflage', creature.camouflage],
              ['energyEfficiency', creature.energyEfficiency],
            ] as const
          ).map(([trait, value]) => (
            <div key={trait} className="metric-card">
              <span>{TRAIT_LABELS[trait]}</span>
              <strong>{Math.round(value * 100)}%</strong>
            </div>
          ))}

          <div className="metric-card">
            <span>Survival estimate</span>
            <strong>{Math.round(creature.currentSurvivalProbability * 100)}%</strong>
          </div>
          <div className="metric-card">
            <span>Generation born</span>
            <strong>{creature.generationBorn}</strong>
          </div>
          <div className="metric-card">
            <span>Parent</span>
            <strong>{creature.parentId ?? 'Founding population'}</strong>
          </div>
          <div className="metric-card metric-card--wide">
            <span>Helped by</span>
            <strong>{strongestPressure(creature, 'help')}</strong>
          </div>
          <div className="metric-card metric-card--wide">
            <span>Hurt by</span>
            <strong>{strongestPressure(creature, 'hurt')}</strong>
          </div>
          <div className="metric-card metric-card--wide">
            <span>Field position</span>
            <strong>{describeCreaturePosition(creature)}</strong>
          </div>
        </div>

      ) : null}

      {creature ? (
        <div className="trait-delta-block">
          <h3>Pressure fit breakdown</h3>
          <ul className="rank-list">
            {pressureBreakdown.map(([pressure, value]) => (
              <li key={pressure}>
                <span>{PRESSURE_LABELS[pressure]}</span>
                <strong className={value >= 0 ? 'delta-positive' : 'delta-negative'}>
                  {value >= 0 ? '+' : ''}
                  {Math.round(value * 100)} pts
                </strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
