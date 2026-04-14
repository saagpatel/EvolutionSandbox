export function ExampleArtifactsPanel({
  onDownloadScenarioExample,
  onDownloadExperimentExample,
}: {
  onDownloadScenarioExample: (scenarioId: string) => void
  onDownloadExperimentExample: (scenarioId: string) => void
}) {
  return (
    <section className="panel">
      <div className="panel__header">
        <p className="eyebrow">Portable Examples</p>
        <h2>Try the sharing flow without making your own file first</h2>
        <p className="muted">
          These downloads let reviewers test scenario and experiment imports right away, without touching local storage first.
        </p>
      </div>

      <div className="guide-callout">
        <span>Recommended reviewer path</span>
        <ul className="bullet-list">
          <li>Download `Balanced World`, import it into Scenario Studio, and confirm the review step.</li>
          <li>Run and save one baseline in the Sandbox, then compare it against a fresh run or import the sample experiment.</li>
        </ul>
      </div>

      <div className="guide-list">
        <div>
          <strong>Sample scenarios</strong>
          <span>Grab a built-in world file, then import it into Scenario Studio to see the dedupe and selection flow.</span>
        </div>
        <div className="stack-actions stack-actions--wrap">
          <button type="button" className="button button--ghost" onClick={() => onDownloadScenarioExample('balanced-world')}>
            Download Balanced World scenario
          </button>
          <button type="button" className="button button--ghost" onClick={() => onDownloadScenarioExample('predator-pulse')}>
            Download Predator Pulse scenario
          </button>
        </div>
        <div>
          <strong>Sample experiment</strong>
          <span>
            Download one deterministic completed run, then import it into the Lab to verify the replay and baseline flow.
          </span>
        </div>
        <div className="stack-actions stack-actions--wrap">
          <button type="button" className="button button--ghost" onClick={() => onDownloadExperimentExample('balanced-world')}>
            Download Balanced World experiment
          </button>
        </div>
      </div>
    </section>
  )
}
