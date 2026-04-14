import { MUTATION_RATE_MAX, MUTATION_RATE_MIN, PRESSURE_LABELS, toPercent } from '@/domain/config'
import type { SimulationConfig } from '@/domain/types'

interface ControlsPanelProps {
  config: SimulationConfig
  onChange: (field: Exclude<keyof SimulationConfig, 'seed' | 'scenarioId'>, value: number) => void
  disabled?: boolean
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  disabled,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="control-row">
      <div className="control-row__header">
        <span>{label}</span>
        <strong>
          {value}
          {suffix}
        </strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function ControlsPanel({ config, onChange, disabled = false }: ControlsPanelProps) {
  return (
    <section className="panel panel--controls">
      <div className="panel__header">
        <p className="eyebrow">World Controls</p>
        <h2>Selection pressures</h2>
        <p className="muted">
          Change the world, then watch which traits rise, bottleneck, or disappear.
        </p>
      </div>

      <div className="control-group">
        <SliderRow
          label={PRESSURE_LABELS.foodScarcity}
          value={toPercent(config.foodScarcity)}
          min={0}
          max={100}
          step={1}
          suffix="%"
          disabled={disabled}
          onChange={(value) => onChange('foodScarcity', value / 100)}
        />
        <SliderRow
          label={PRESSURE_LABELS.predationPressure}
          value={toPercent(config.predationPressure)}
          min={0}
          max={100}
          step={1}
          suffix="%"
          disabled={disabled}
          onChange={(value) => onChange('predationPressure', value / 100)}
        />
        <SliderRow
          label={PRESSURE_LABELS.coldStress}
          value={toPercent(config.coldStress)}
          min={0}
          max={100}
          step={1}
          suffix="%"
          disabled={disabled}
          onChange={(value) => onChange('coldStress', value / 100)}
        />
        <SliderRow
          label={PRESSURE_LABELS.habitatVisibility}
          value={toPercent(config.habitatVisibility)}
          min={0}
          max={100}
          step={1}
          suffix="%"
          disabled={disabled}
          onChange={(value) => onChange('habitatVisibility', value / 100)}
        />
      </div>

      <div className="panel__header">
        <p className="eyebrow">Run Tuning</p>
        <h2>Mutation and scale</h2>
      </div>

      <div className="control-group">
        <SliderRow
          label="Mutation rate"
          value={Math.round(config.mutationRate * 1000) / 10}
          min={MUTATION_RATE_MIN * 100}
          max={MUTATION_RATE_MAX * 100}
          step={0.1}
          suffix="%"
          disabled={disabled}
          onChange={(value) => onChange('mutationRate', value / 100)}
        />
        <SliderRow
          label="Starting population"
          value={config.startingPopulation}
          min={100}
          max={1000}
          step={50}
          suffix=""
          disabled={disabled}
          onChange={(value) => onChange('startingPopulation', value)}
        />
        <SliderRow
          label="Generation target"
          value={config.generationTarget}
          min={25}
          max={200}
          step={25}
          suffix=""
          disabled={disabled}
          onChange={(value) => onChange('generationTarget', value)}
        />
      </div>
    </section>
  )
}
