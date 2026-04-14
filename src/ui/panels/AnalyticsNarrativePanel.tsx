export function AnalyticsNarrativePanel({ lines }: { lines: string[] }) {
  if (lines.length === 0) {
    return null
  }

  return (
    <section className="panel panel--subtle">
      <div className="panel__header">
        <p className="eyebrow">Text Summary</p>
        <h2>What the charts are saying</h2>
        <p className="muted">
          This text version mirrors the selected generation trends so the analytics are readable without relying on the
          graphs alone.
        </p>
      </div>

      <ul className="bullet-list">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}
