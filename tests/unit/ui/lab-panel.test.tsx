import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import type { LabQuarantineSummary, SavedExperiment } from '@/domain/types'
import { LabPanel } from '@/ui/panels/LabPanel'

expect.extend(toHaveNoViolations)

const sampleQuarantine: LabQuarantineSummary = {
  id: 'experiment:legacy-experiment',
  kind: 'experiment',
  originalKey: 'legacy-experiment',
  observedSchemaVersion: 'legacy-schema',
  observedRulesetVersion: 'v2.1.0',
  originalSavedAt: '2026-04-13T08:00:00.000Z',
  quarantinedAt: '2026-09-10T12:00:00.000Z',
  reason: 'The saved experiment record uses schema legacy-schema, which this app cannot load.',
}

function renderLabPanel({
  quarantine = [sampleQuarantine],
  experiments = [],
  onRestoreQuarantine = vi.fn(),
  onExportQuarantine = vi.fn(),
  onClearQuarantine = vi.fn(),
}: {
  quarantine?: LabQuarantineSummary[]
  experiments?: SavedExperiment[]
  onRestoreQuarantine?: (quarantineId: string) => void
  onExportQuarantine?: () => void
  onClearQuarantine?: () => void
} = {}) {
  return render(
    <LabPanel
      experiments={experiments}
      baselineExperimentId={null}
      sort="updated"
      quarantine={quarantine}
      onSetSort={vi.fn()}
      onSetBaseline={vi.fn()}
      onOpenExperiment={vi.fn()}
      onUpdateExperiment={vi.fn()}
      onDeleteExperiment={vi.fn()}
      onExportExperiment={vi.fn()}
      onImportExperiment={vi.fn()}
      onRestoreQuarantine={onRestoreQuarantine}
      onExportQuarantine={onExportQuarantine}
      onClearQuarantine={onClearQuarantine}
    />,
  )
}

describe('lab recovery panel', () => {
  it('shows recovery metadata and actions without raw payloads', () => {
    const { container } = renderLabPanel()

    expect(screen.getByRole('heading', { name: 'Incompatible lab records' })).toBeInTheDocument()
    expect(screen.getByText('Held records')).toBeInTheDocument()
    expect(screen.getByText('1 incompatible record is held locally so it can be restored or exported. Raw payloads stay out of this list.')).toBeInTheDocument()
    expect(screen.getByText('legacy-experiment')).toBeInTheDocument()
    expect(screen.getByText(`schema ${sampleQuarantine.observedSchemaVersion}`)).toBeInTheDocument()
    expect(screen.getByText(`ruleset ${sampleQuarantine.observedRulesetVersion}`)).toBeInTheDocument()
    expect(screen.getByText(sampleQuarantine.reason)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export recovery data' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear recovery records' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore experiment legacy-experiment' })).toBeInTheDocument()
    expect(container.textContent).not.toContain('rawRecord')
    expect(container.textContent).not.toContain('"payload"')
  })

  it('requires explicit confirmation before clearing recovery records and restores focus on cancel', async () => {
    const user = userEvent.setup()
    const onClearQuarantine = vi.fn()
    renderLabPanel({ onClearQuarantine })

    await user.click(screen.getByRole('button', { name: 'Clear recovery records' }))

    expect(screen.getByRole('button', { name: 'Confirm clear recovery records' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(/recovery copies only/i)
    expect(onClearQuarantine).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancel clear' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear recovery records' })).toHaveFocus()
    })
    expect(onClearQuarantine).not.toHaveBeenCalled()
  })

  it('clears only after confirmation and moves focus to saved experiments', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [quarantine, setQuarantine] = useState([sampleQuarantine])
      return (
        <LabPanel
          experiments={[]}
          baselineExperimentId={null}
          sort="updated"
          quarantine={quarantine}
          onSetSort={vi.fn()}
          onSetBaseline={vi.fn()}
          onOpenExperiment={vi.fn()}
          onUpdateExperiment={vi.fn()}
          onDeleteExperiment={vi.fn()}
          onExportExperiment={vi.fn()}
          onImportExperiment={vi.fn()}
          onRestoreQuarantine={vi.fn()}
          onExportQuarantine={vi.fn()}
          onClearQuarantine={() => setQuarantine([])}
        />
      )
    }

    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Clear recovery records' }))
    await user.click(screen.getByRole('button', { name: 'Confirm clear recovery records' }))

    expect(screen.queryByRole('heading', { name: 'Incompatible lab records' })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Saved experiments' })).toHaveFocus()
    })
  })

  it('invokes restore and export actions from visible controls', async () => {
    const user = userEvent.setup()
    const onRestoreQuarantine = vi.fn()
    const onExportQuarantine = vi.fn()
    renderLabPanel({ onRestoreQuarantine, onExportQuarantine })

    await user.click(screen.getByRole('button', { name: 'Restore experiment legacy-experiment' }))
    await user.click(screen.getByRole('button', { name: 'Export recovery data' }))

    expect(onRestoreQuarantine).toHaveBeenCalledWith('experiment:legacy-experiment')
    expect(onExportQuarantine).toHaveBeenCalledTimes(1)
  })

  it('has no obvious accessibility violations in the recovery section', async () => {
    const { container } = renderLabPanel()
    const results = await axe(container)

    expect(results).toHaveNoViolations()
  })
})
