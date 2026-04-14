import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { TRAIT_LABELS } from '@/domain/config'
import type { CompletedRunSummary, GenerationSnapshot } from '@/domain/types'

const traitColors = {
  size: '#ff875f',
  speed: '#6ce6cb',
  camouflage: '#7bc97b',
  energyEfficiency: '#f9c74f',
} as const

type TraitKey = keyof typeof traitColors

type SeriesPoint = {
  generation: number
  population: number
  survivalRate: number
  previousSurvivalRate: number | null
  diversityScore: number
  dominantPhenotypeShare: number
  size: number
  speed: number
  camouflage: number
  energyEfficiency: number
}

type DistributionPoint = {
  bucket: string
  size: number
  speed: number
  camouflage: number
  energyEfficiency: number
}

type SeriesLineDefinition = {
  color: string
  key: keyof SeriesPoint
  label: string
  strokeWidth?: number
}

type DistributionBarDefinition = {
  color: string
  key: TraitKey
  label: string
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

type PositionedPoint = {
  defined: boolean
  x: number
  y: number
}

function buildSeries(snapshots: GenerationSnapshot[], previousRun: CompletedRunSummary | null): SeriesPoint[] {
  return snapshots.map((snapshot, index) => ({
    generation: snapshot.generationIndex,
    population: snapshot.populationSize,
    survivalRate: Math.round(snapshot.survivalRate * 100),
    previousSurvivalRate: previousRun ? Math.round((previousRun.survivalCurve[index] ?? 0) * 100) : null,
    diversityScore: Math.round(snapshot.diversityScore * 100),
    dominantPhenotypeShare: Math.round(snapshot.dominantPhenotypeShare * 100),
    size: Math.round(snapshot.meanTraitValues.size * 100),
    speed: Math.round(snapshot.meanTraitValues.speed * 100),
    camouflage: Math.round(snapshot.meanTraitValues.camouflage * 100),
    energyEfficiency: Math.round(snapshot.meanTraitValues.energyEfficiency * 100),
  }))
}

function buildDistribution(snapshot: GenerationSnapshot): DistributionPoint[] {
  return snapshot.traitDistributions.size.map((_, index) => ({
    bucket: `${index * 10}-${index * 10 + 10}`,
    size: snapshot.traitDistributions.size[index] ?? 0,
    speed: snapshot.traitDistributions.speed[index] ?? 0,
    camouflage: snapshot.traitDistributions.camouflage[index] ?? 0,
    energyEfficiency: snapshot.traitDistributions.energyEfficiency[index] ?? 0,
  }))
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="chart-card">
      <h3>{title}</h3>
      <div className="chart-card__body">{children}</div>
    </section>
  )
}

function MeasuredChart({
  children,
}: {
  children: (size: { width: number; height: number }) => ReactNode
}) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) {
      return undefined
    }

    const measure = () => {
      const width = Math.max(0, Math.floor(frame.clientWidth))
      const height = Math.max(0, Math.floor(frame.clientHeight))
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={frameRef} className="chart-frame">
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  )
}

function ChartLegend({ items }: { items: Array<{ color: string; key: string; label: string }> }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={String(item.key)} className="chart-legend__item">
          <i style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

function buildLinePath(points: PositionedPoint[]) {
  let path = ''

  for (const point of points) {
    if (!point.defined) {
      continue
    }

    path += path === '' ? `M ${point.x} ${point.y}` : ` L ${point.x} ${point.y}`
  }

  return path
}

function getXAxisLabels(generations: number[]) {
  if (generations.length === 0) {
    return []
  }

  const first = generations[0] ?? 0
  const mid = generations[Math.floor(generations.length / 2)] ?? first
  const last = generations[generations.length - 1] ?? first
  const labels = new Set<number>([first, mid, last])

  return generations.filter((generation) => labels.has(generation))
}

function SimpleLineChart({
  data,
  lines,
  selectedGeneration,
  yDomain,
}: {
  data: SeriesPoint[]
  lines: SeriesLineDefinition[]
  selectedGeneration: number
  yDomain?: [number, number]
}) {
  const width = 720
  const height = 260
  const padding = { top: 16, right: 20, bottom: 28, left: 36 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const generations = data.map((entry) => Number(entry.generation ?? 0))
  const selectedIndex = generations.indexOf(selectedGeneration)
  const resolvedDomain = useMemo<[number, number]>(() => {
    if (yDomain) {
      return yDomain
    }

    const values = data.flatMap((entry) => lines.map((line) => entry[line.key]).filter(isFiniteNumber))

    const maxValue = values.length ? Math.max(...values) : 1
    return [0, Math.max(1, Math.ceil(maxValue))]
  }, [data, lines, yDomain])

  const [minY, maxY] = resolvedDomain
  const yRange = Math.max(1, maxY - minY)

  const projectX = (index: number) =>
    padding.left + (generations.length <= 1 ? innerWidth / 2 : (index / (generations.length - 1)) * innerWidth)
  const projectY = (value: number) => padding.top + innerHeight - ((value - minY) / yRange) * innerHeight

  const xAxisLabels = getXAxisLabels(generations)
  const yAxisLabels = [maxY, Math.round((minY + maxY) / 2), minY]

  return (
    <div className="chart-shell">
      <ChartLegend items={lines} />
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Simulation trend chart">
        <g className="chart-grid">
          {yAxisLabels.map((tick) => {
            const y = projectY(tick)
            return <line key={tick} x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
          })}
          {xAxisLabels.map((generation) => {
            const index = generations.indexOf(generation)
            const x = projectX(index)
            return <line key={generation} x1={x} x2={x} y1={padding.top} y2={height - padding.bottom} />
          })}
        </g>

        {selectedIndex >= 0 ? (
          <line
            className="chart-selected-line"
            x1={projectX(selectedIndex)}
            x2={projectX(selectedIndex)}
            y1={padding.top}
            y2={height - padding.bottom}
          />
        ) : null}

        {lines.map((line) => {
          const points = data.map((entry, index) => {
            const value = entry[line.key]

            if (typeof value !== 'number' || !Number.isFinite(value)) {
              return { defined: false, x: projectX(index), y: projectY(minY) }
            }

            return {
              defined: true,
              x: projectX(index),
              y: projectY(value),
            }
          })

          const selectedPoint = selectedIndex >= 0 ? points[selectedIndex] : null

          return (
            <g key={String(line.key)}>
              <path
                d={buildLinePath(points)}
                fill="none"
                stroke={line.color}
                strokeWidth={line.strokeWidth ?? 2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {selectedPoint?.defined ? (
                <circle cx={selectedPoint.x} cy={selectedPoint.y} r="4" fill={line.color} stroke="#071218" strokeWidth="2" />
              ) : null}
            </g>
          )
        })}

        <g className="chart-axis">
          {yAxisLabels.map((tick) => (
            <text key={tick} x={padding.left - 10} y={projectY(tick) + 4} textAnchor="end">
              {tick}
            </text>
          ))}
          {xAxisLabels.map((generation) => {
            const index = generations.indexOf(generation)
            return (
              <text key={generation} x={projectX(index)} y={height - 8} textAnchor="middle">
                g{generation}
              </text>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

function SimpleDistributionChart({
  data,
  bars,
}: {
  data: DistributionPoint[]
  bars: DistributionBarDefinition[]
}) {
  const width = 720
  const height = 260
  const padding = { top: 16, right: 20, bottom: 34, left: 36 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const groupWidth = innerWidth / Math.max(1, data.length)
  const barWidth = Math.max(6, (groupWidth - 6) / bars.length)
  const maxValue = Math.max(1, ...data.flatMap((entry) => bars.map((bar) => (typeof entry[bar.key] === 'number' ? entry[bar.key] : 0))))

  const projectY = (value: number) => padding.top + innerHeight - (value / maxValue) * innerHeight

  return (
    <div className="chart-shell">
      <ChartLegend items={bars} />
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trait distribution chart">
        <g className="chart-grid">
          {[0, maxValue / 2, maxValue].map((tick) => {
            const rounded = Math.round(tick)
            const y = projectY(tick)
            return <line key={rounded} x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
          })}
        </g>

        {data.map((entry, groupIndex) => {
          const groupX = padding.left + groupIndex * groupWidth + 3

          return (
            <g key={entry.bucket}>
              {bars.map((bar, barIndex) => {
                const rawValue = entry[bar.key]
                const value = typeof rawValue === 'number' ? rawValue : 0
                const y = projectY(value)
                const barX = groupX + barIndex * barWidth
                return (
                  <rect
                    key={String(bar.key)}
                    x={barX}
                    y={y}
                    width={barWidth - 2}
                    height={Math.max(0, padding.top + innerHeight - y)}
                    rx="2"
                    fill={bar.color}
                    opacity="0.88"
                  />
                )
              })}
            </g>
          )
        })}

        <g className="chart-axis">
          <text x={padding.left - 10} y={projectY(maxValue) + 4} textAnchor="end">
            {Math.round(maxValue)}
          </text>
          <text x={padding.left - 10} y={projectY(maxValue / 2) + 4} textAnchor="end">
            {Math.round(maxValue / 2)}
          </text>
          <text x={padding.left - 10} y={projectY(0) + 4} textAnchor="end">
            0
          </text>
          {data.map((entry, groupIndex) => (
            <text
              key={entry.bucket}
              x={padding.left + groupIndex * groupWidth + groupWidth / 2}
              y={height - 8}
              textAnchor="middle"
            >
              {entry.bucket}
            </text>
          ))}
        </g>
      </svg>
    </div>
  )
}

export function AnalyticsPanel({
  snapshots,
  selectedSnapshot,
  previousRun,
  compareMode,
}: {
  snapshots: GenerationSnapshot[]
  selectedSnapshot: GenerationSnapshot
  previousRun: CompletedRunSummary | null
  compareMode: boolean
}) {
  const lineSeries = buildSeries(snapshots, compareMode ? previousRun : null)
  const distributionSeries = buildDistribution(selectedSnapshot)
  const selectedGeneration = selectedSnapshot.generationIndex
  const traitLines: SeriesLineDefinition[] = (Object.entries(traitColors) as Array<[TraitKey, string]>).map(([trait, color]) => ({
      color,
      key: trait,
      label: TRAIT_LABELS[trait],
    }))
  const distributionBars: DistributionBarDefinition[] = traitLines.map((line) => ({
    color: line.color,
    key: line.key as TraitKey,
    label: line.label,
  }))
  const populationLine: SeriesLineDefinition[] = [{ color: '#ff875f', key: 'population', label: 'Population', strokeWidth: 2.5 }]
  const survivalLines: SeriesLineDefinition[] = [
    { color: '#6ce6cb', key: 'survivalRate', label: 'Current run', strokeWidth: 2.5 },
    ...(compareMode && previousRun
      ? [{ color: '#9b8cff', key: 'previousSurvivalRate' as const, label: 'Previous run', strokeWidth: 2 }]
      : []),
  ]
  const diversityLines: SeriesLineDefinition[] = [
    { color: '#9b8cff', key: 'diversityScore', label: 'Diversity score', strokeWidth: 2.5 },
    { color: '#f9c74f', key: 'dominantPhenotypeShare', label: 'Dominant phenotype share', strokeWidth: 2 },
  ]

  return (
    <div className="analytics-grid">
      <ChartCard title="Population size">
        <MeasuredChart>
          {() => (
            <SimpleLineChart data={lineSeries} lines={populationLine} selectedGeneration={selectedGeneration} />
          )}
        </MeasuredChart>
      </ChartCard>

      <ChartCard title="Mean trait values">
        <MeasuredChart>
          {() => <SimpleLineChart data={lineSeries} lines={traitLines} selectedGeneration={selectedGeneration} yDomain={[0, 100]} />}
        </MeasuredChart>
      </ChartCard>

      <ChartCard title="Trait distribution at selected generation">
        <MeasuredChart>{() => <SimpleDistributionChart data={distributionSeries} bars={distributionBars} />}</MeasuredChart>
      </ChartCard>

      <ChartCard title="Survival rate">
        <MeasuredChart>
          {() => (
            <SimpleLineChart data={lineSeries} lines={survivalLines} selectedGeneration={selectedGeneration} yDomain={[0, 100]} />
          )}
        </MeasuredChart>
      </ChartCard>

      <ChartCard title="Diversity over time">
        <MeasuredChart>
          {() => (
            <SimpleLineChart data={lineSeries} lines={diversityLines} selectedGeneration={selectedGeneration} yDomain={[0, 100]} />
          )}
        </MeasuredChart>
      </ChartCard>
    </div>
  )
}
