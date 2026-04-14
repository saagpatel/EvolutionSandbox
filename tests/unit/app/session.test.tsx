import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from '@/app/App'
import { buildScenarioArtifact, serializeArtifact } from '@/domain/artifacts'
import { BUILT_IN_SCENARIOS } from '@/domain/scenarios'

describe('app shell', () => {
  it('lets the user step the simulation and keeps summary text visible', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Step' }))

    expect(screen.getAllByText('Selected population').length).toBeGreaterThan(0)
    expect(screen.getByTestId('population-size')).toBeInTheDocument()
    expect(screen.getByTestId('summary-lines').querySelectorAll('li').length).toBeGreaterThan(0)
    expect(screen.getByText('Diversity score')).toBeInTheDocument()
    expect(screen.getByText('Dominant phenotype')).toBeInTheDocument()
  })

  it('supports selecting a creature from the keyboard-friendly roster', async () => {
    const user = userEvent.setup()
    render(<App />)

    const creatureOptions = screen.getAllByRole('option')
    expect(creatureOptions.length).toBeGreaterThan(0)

    await user.click(creatureOptions[0]!)

    expect(screen.getByRole('option', { selected: true })).toBeInTheDocument()
    expect(screen.getByRole('listbox', { name: /creature roster/i })).toBeInTheDocument()
  })

  it('shows a guided quickstart step and exposes surface tabs semantically', () => {
    render(<App />)

    expect(screen.getByRole('tablist', { name: /workspace surfaces/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Sandbox', selected: true })).toBeInTheDocument()
    expect(screen.getByText(/Recommended next action/i)).toBeInTheDocument()
  })

  it('reviews a scenario file before import instead of changing state immediately', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Scenarios' }))
    await screen.findByRole('button', { name: /import scenario/i })

    const fileInput = document.querySelector<HTMLInputElement>('input[aria-label="Choose scenario file"]')
    expect(fileInput).not.toBeNull()
    const artifact = buildScenarioArtifact(BUILT_IN_SCENARIOS[0]!)
    const file = new File([serializeArtifact(artifact)], 'balanced-world.scenario.json', {
      type: 'application/json',
    })

    await user.upload(fileInput!, file)

    expect(await screen.findByText(/already matches a scenario in the local library/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /use local scenario/i })).toBeInTheDocument()
  })
})
