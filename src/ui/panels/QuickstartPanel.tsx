import type { QuickstartStep } from '@/domain/types'

export function QuickstartPanel({
  step,
  onAction,
  onDismiss,
}: {
  step: QuickstartStep | null
  onAction: () => void
  onDismiss: () => void
}) {
  if (!step) {
    return null
  }

  return (
    <section className="panel panel--guide">
      <div className="panel__header">
        <p className="eyebrow">Quickstart</p>
        <h2>{step.title}</h2>
        <p className="muted">{step.description}</p>
      </div>

      <div className="guide-callout">
        <span>Recommended next action</span>
        <strong>{step.actionLabel}</strong>
      </div>

      <div className="stack-actions stack-actions--wrap">
        <button type="button" className="button" onClick={onAction}>
          {step.actionLabel}
        </button>
        <button type="button" className="button button--ghost" onClick={onDismiss}>
          Dismiss guide
        </button>
      </div>
    </section>
  )
}
