export function ReadingGuidePanel() {
  return (
    <section className="panel panel--guide">
      <div className="panel__header">
        <p className="eyebrow">Reading Guide</p>
        <h2>How to read a run in one minute</h2>
        <p className="muted">
          Start with the story, then confirm it in the field and charts.
        </p>
      </div>

      <ol className="guide-list">
        <li>
          <strong>Read the summary first.</strong>
          <span>It tells you which pressure changed the world and which traits gained or lost ground.</span>
        </li>
        <li>
          <strong>Scan the phenotype field next.</strong>
          <span>Faster creatures drift right, better-camouflaged creatures rise upward, and larger bodies scale up.</span>
        </li>
        <li>
          <strong>Use the charts as proof.</strong>
          <span>Population, trait, survival, and diversity curves should all reinforce the same story.</span>
        </li>
      </ol>

      <div className="guide-callout">
        <span>Best demo path</span>
        <strong>Balanced World → Predator Pulse → Cold Snap Recovery</strong>
      </div>
    </section>
  )
}
