import { TRAIT_LABELS } from '@/domain/config'
import type { ComparisonSummary } from '@/domain/types'

export function ComparisonPanel({ comparison }: { comparison: ComparisonSummary | null }) {
  if (!comparison) {
    return null
  }

  return (
    <section className="panel panel--comparison" data-testid="comparison-panel">
      <div className="panel__header">
        <p className="eyebrow">Current vs Baseline</p>
        <h2>Experiment comparison</h2>
        <p className="muted">{comparison.summaryText}</p>
      </div>

      <div className="comparison-grid">
        <div className="metric-card">
          <span>Final population delta</span>
          <strong>{comparison.finalPopulationDelta > 0 ? '+' : ''}{comparison.finalPopulationDelta}</strong>
        </div>
        <div className="metric-card">
          <span>Final survival delta</span>
          <strong>
            {comparison.survivalCurveDelta > 0 ? '+' : ''}
            {Math.round(comparison.survivalCurveDelta * 100)}%
          </strong>
        </div>
        <div className="metric-card metric-card--wide">
          <span>Biggest winner</span>
          <strong>{TRAIT_LABELS[comparison.biggestWinnerTrait]}</strong>
        </div>
        <div className="metric-card metric-card--wide">
          <span>Biggest loser</span>
          <strong>{TRAIT_LABELS[comparison.biggestLoserTrait]}</strong>
        </div>
      </div>

      <div className="trait-delta-block">
        <h3>Mean trait deltas</h3>
        <ul className="rank-list">
          {(Object.entries(comparison.meanTraitDeltas) as Array<
            [keyof typeof comparison.meanTraitDeltas, number]
          >).map(([trait, delta]) => (
            <li key={trait}>
              <span>{TRAIT_LABELS[trait]}</span>
              <strong>
                {delta > 0 ? '+' : ''}
                {Math.round(delta * 100)} pts
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
