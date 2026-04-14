import type { EventFlag, GenerationSnapshot } from '@/domain/types'

const EVENT_LABELS: Record<EventFlag, string> = {
  bottleneck: 'Bottleneck',
  recovery: 'Recovery',
  lowDiversity: 'Low diversity',
  diversityRecovery: 'Diversity rebound',
  extinction: 'Extinction',
}

type TimelineMarker = {
  id: string
  generationIndex: number
  label: string
  variant: `event-chip--${EventFlag}` | 'event-chip--scenario'
}

const MARKER_ROW_HEIGHT = 30
const MARKER_MIN_GAP_PERCENT = 10

function assignRows(markers: TimelineMarker[], maxGeneration: number, rowOffset: number) {
  const rowEnds: number[] = []

  return markers.map((marker) => {
    const leftPercent = (marker.generationIndex / Math.max(maxGeneration, 1)) * 100
    let localRow = rowEnds.findIndex((rowEnd) => leftPercent - rowEnd >= MARKER_MIN_GAP_PERCENT)

    if (localRow === -1) {
      localRow = rowEnds.length
      rowEnds.push(leftPercent)
    } else {
      rowEnds[localRow] = leftPercent
    }

    return {
      ...marker,
      leftPercent,
      row: rowOffset + localRow,
    }
  })
}

export function Timeline({
  snapshots,
  selectedGeneration,
  onChange,
}: {
  snapshots: GenerationSnapshot[]
  selectedGeneration: number
  onChange: (generationIndex: number) => void
}) {
  const max = Math.max(0, snapshots.length - 1)
  const scenarioMarkers = snapshots
    .flatMap<TimelineMarker>((snapshot) =>
      snapshot.triggeredScenarioEvent
        ? [
            {
              id: `scenario-${snapshot.generationIndex}-${snapshot.triggeredScenarioEvent.id}`,
              generationIndex: snapshot.generationIndex,
              label: snapshot.triggeredScenarioEvent.label,
              variant: 'event-chip--scenario',
            },
          ]
        : [],
    )
    .sort((left, right) => left.generationIndex - right.generationIndex)
  const positionedScenarioMarkers = assignRows(scenarioMarkers, max, 0)
  const emergentMarkers = snapshots
    .flatMap<TimelineMarker>((snapshot) =>
      snapshot.eventFlags.map((flag) => ({
        id: `event-${snapshot.generationIndex}-${flag}`,
        generationIndex: snapshot.generationIndex,
        label: EVENT_LABELS[flag],
        variant: `event-chip--${flag}`,
      })),
    )
    .sort((left, right) => left.generationIndex - right.generationIndex)
  const scenarioRowCount =
    positionedScenarioMarkers.reduce((maxRow, marker) => Math.max(maxRow, marker.row + 1), 0)
  const emergentRowOffset = scenarioRowCount > 0 ? scenarioRowCount + 1 : 0
  const positionedEmergentMarkers = assignRows(emergentMarkers, max, emergentRowOffset)
  const totalRows = [...positionedScenarioMarkers, ...positionedEmergentMarkers].reduce(
    (maxRow, marker) => Math.max(maxRow, marker.row + 1),
    1,
  )

  return (
    <section className="timeline panel">
      <div className="timeline__header">
        <div>
          <p className="eyebrow">Timeline</p>
          <h2>Generation scrubber</h2>
        </div>
        <strong>Generation {selectedGeneration}</strong>
      </div>

      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={selectedGeneration}
        aria-label="Generation scrubber"
        onChange={(event) => onChange(Number(event.target.value))}
      />

      <div className="timeline__legend">
        <span className="timeline-key">
          <span className="timeline-key__dot timeline-key__dot--scenario" />
          Scenario events
        </span>
        <span className="timeline-key">
          <span className="timeline-key__dot timeline-key__dot--emergent" />
          Emergent population events
        </span>
      </div>

      <div className="timeline__markers" style={{ minHeight: `${totalRows * MARKER_ROW_HEIGHT + 8}px` }}>
        {[...positionedScenarioMarkers, ...positionedEmergentMarkers].map((marker) => (
          <button
            key={marker.id}
            className={`event-chip ${marker.variant}`}
            style={{
              left: `${marker.leftPercent}%`,
              top: `${marker.row * MARKER_ROW_HEIGHT}px`,
            }}
            onClick={() => onChange(marker.generationIndex)}
            type="button"
            title={`${marker.label} · generation ${marker.generationIndex}`}
            aria-label={`${marker.label} at generation ${marker.generationIndex}`}
            aria-pressed={selectedGeneration === marker.generationIndex}
          >
            {marker.label}
          </button>
        ))}
      </div>
    </section>
  )
}
