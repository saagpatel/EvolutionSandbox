import type { ArtifactImportReview } from '@/domain/types'

export function ImportReviewPanel({
  review,
  onConfirm,
  onCancel,
}: {
  review: ArtifactImportReview
  onConfirm: () => void
  onCancel: () => void
}) {
  const primaryActionLabel = review.action === 'blocked' ? 'Close review' : review.actionLabel

  return (
    <section className="panel panel--guide">
      <div className="panel__header">
        <p className="eyebrow">Import Review</p>
        <h2>{review.title}</h2>
        <p className="muted">{review.summary}</p>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Artifact type</span>
          <strong>{review.kind}</strong>
        </div>
        <div className="metric-card">
          <span>Selected file</span>
          <strong>{review.fileName}</strong>
        </div>
        <div className="metric-card metric-card--wide">
          <span>File size</span>
          <strong>{review.fileSizeLabel}</strong>
        </div>
      </div>

      {review.details.length > 0 ? (
        <div className="guide-callout">
          <span>What this file will do</span>
          <ul className="bullet-list">
            {review.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {review.warnings.length > 0 ? (
        <div className="import-review__warnings">
          <span>Things to know first</span>
          <ul className="bullet-list">
            {review.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="stack-actions stack-actions--wrap">
        <button type="button" className="button" onClick={onConfirm} autoFocus>
          {primaryActionLabel}
        </button>
        <button type="button" className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}
