import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStore, set } from 'idb-keyval'
import { axe, toHaveNoViolations } from 'jest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/app/App'
import { SIM_RULESET_VERSION, STORAGE_SCHEMA_VERSION } from '@/domain/config'
import { createScenarioDraft } from '@/domain/scenarios'
import type { SavedExperiment } from '@/domain/types'
import { LAB_STORAGE_NAMES, clearLabData } from '@/infra/labStorage'
import * as fileArtifacts from '@/infra/fileArtifacts'

expect.extend(toHaveNoViolations)

const sampleScenario = createScenarioDraft('Stored Scenario')
const hiddenPayloadMarker = 'PAYLOAD_SHOULD_NOT_RENDER_abc123'

const sampleExperiment: SavedExperiment = {
  id: 'experiment-1',
  name: 'Stored Experiment',
  note: 'Useful baseline',
  createdAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
  recipe: {
    scenario: sampleScenario,
    config: sampleScenario.baseConfig,
    seed: sampleScenario.baseConfig.seed,
    rulesetVersion: SIM_RULESET_VERSION,
  },
  completedSummary: {
    rulesetVersion: SIM_RULESET_VERSION,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    configHash: 'abc12345',
    scenarioHash: 'scenario12345',
    seed: sampleScenario.baseConfig.seed,
    scenarioId: sampleScenario.id,
    scenarioName: sampleScenario.name,
    finalGeneration: 5,
    finalPopulationSize: 380,
    finalMeanTraits: {
      size: 0.5,
      speed: 0.52,
      camouflage: 0.49,
      energyEfficiency: 0.55,
    },
    populationCurve: [400, 398, 390, 385, 382, 380],
    survivalCurve: [1, 0.61, 0.59, 0.58, 0.57, 0.56],
    diversityCurve: [0.58, 0.56, 0.51, 0.48, 0.46, 0.44],
    dominantPhenotypeCurve: [0.14, 0.15, 0.18, 0.22, 0.25, 0.28],
    meanTraitCurves: {
      size: [0.5],
      speed: [0.52],
      camouflage: [0.49],
      energyEfficiency: [0.55],
    },
    finalSummary: ['Test summary'],
    runHash: 'run12345',
  },
}

describe('lab recovery session', () => {
  beforeEach(async () => {
  window.localStorage.clear()
  vi.restoreAllMocks()
  await clearLabData()
    const experimentStore = createStore(LAB_STORAGE_NAMES.experimentsDb, LAB_STORAGE_NAMES.storeName)
    await set(
      'legacy-experiment',
      {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        rulesetVersion: 'legacy-ruleset',
        savedAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
        payload: {
          ...sampleExperiment,
          note: hiddenPayloadMarker,
        },
      },
      experimentStore,
    )
  })

  it('threads quarantine summaries into Lab and announces the recovery notice', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      (await screen.findAllByText('One incompatible saved lab record was moved to local recovery after a version change.')).length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('status')).toHaveTextContent(
      'One incompatible saved lab record was moved to local recovery after a version change.',
    )

    await user.click(screen.getByRole('tab', { name: 'Lab' }))

    expect(await screen.findByRole('heading', { name: 'Incompatible lab records' })).toBeInTheDocument()
    expect(screen.getByText('legacy-experiment')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore experiment legacy-experiment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export recovery data' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear recovery records' })).toBeInTheDocument()
    expect(screen.queryByText(hiddenPayloadMarker)).not.toBeInTheDocument()

    const results = await axe(screen.getByTestId('lab-recovery'))
    expect(results).toHaveNoViolations()
  })

  it('exports local recovery data through the lab controls', async () => {
    const user = userEvent.setup()
    const downloadSpy = vi.spyOn(fileArtifacts, 'downloadJsonFile').mockImplementation(() => undefined)
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Lab' }))
    await screen.findByRole('heading', { name: 'Incompatible lab records' })
    await user.click(screen.getByRole('button', { name: 'Export recovery data' }))

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledTimes(1)
    })
    expect(downloadSpy.mock.calls[0]?.[0]).toBe('evolution-sandbox-local-recovery-data.json')
    const exported = JSON.parse(String(downloadSpy.mock.calls[0]?.[1])) as {
      recoveryType: string
      label: string
      records: Array<{ rawRecord: unknown }>
    }
    expect(exported.recoveryType).toBe('lab-quarantine')
    expect(exported.label).toBe('local recovery data')
    expect(exported.records[0]?.rawRecord).toMatchObject({
      payload: { note: hiddenPayloadMarker },
    })
  })
})
