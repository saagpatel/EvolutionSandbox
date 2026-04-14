import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, expect, it } from 'vitest'

import App from '@/app/App'
import { buildScenarioArtifact, serializeArtifact } from '@/domain/artifacts'
import { BUILT_IN_SCENARIOS } from '@/domain/scenarios'

expect.extend(toHaveNoViolations)

describe('accessibility flows', () => {
  it('has no obvious accessibility violations on first render', async () => {
    const { container } = render(<App />)
    const results = await axe(container)

    expect(results).toHaveNoViolations()
  })

  it('supports keyboard navigation across workspace tabs', async () => {
    const user = userEvent.setup()
    render(<App />)

    const sandboxTab = screen.getByRole('tab', { name: 'Sandbox' })
    sandboxTab.focus()

    await user.keyboard('{ArrowRight}')
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Scenarios', selected: true })).toHaveFocus()
    })

    await user.keyboard('{End}')
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Lab', selected: true })).toHaveFocus()
    })

    await user.keyboard('{Home}')
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Sandbox', selected: true })).toHaveFocus()
    })
  })

  it('moves focus into import review and returns it to the scenario import trigger', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Scenarios' }))
    const importTrigger = await screen.findByRole('button', { name: 'Import scenario' })
    const fileInput = document.querySelector<HTMLInputElement>('input[aria-label="Choose scenario file"]')
    expect(fileInput).not.toBeNull()

    const artifact = buildScenarioArtifact(BUILT_IN_SCENARIOS[0]!)
    const file = new File([serializeArtifact(artifact)], 'balanced-world.scenario.json', {
      type: 'application/json',
    })

    await user.upload(fileInput!, file)

    const reviewAction = await screen.findByRole('button', { name: 'Use local scenario' })
    expect(reviewAction).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(importTrigger).toHaveFocus()
    })
  })
})
