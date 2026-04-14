import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infra/sessionStorage', () => ({
  loadStoredSettings: () => ({
    settings: null,
    notice: {
      level: 'warning' as const,
      message: 'Saved session settings were cleared because the simulation contract changed.',
    },
  }),
  saveStoredSettings: vi.fn(),
}))

vi.mock('@/infra/labStorage', () => ({
  loadLabData: async () => ({
    scenarios: [],
    experiments: [],
    notice: {
      level: 'warning' as const,
      message: 'One incompatible saved lab record was cleared after a version change.',
    },
  }),
  saveScenarioRecord: vi.fn(),
  deleteScenarioRecord: vi.fn(),
  saveExperimentRecord: vi.fn(),
  deleteExperimentRecord: vi.fn(),
}))

import App from '@/app/App'

describe('notices', () => {
  it('shows the lab warning when both session and lab notices are present', async () => {
    render(<App />)

    expect(
      await screen.findByRole('status'),
    ).toHaveTextContent('One incompatible saved lab record was cleared after a version change.')
    expect(screen.getAllByText('One incompatible saved lab record was cleared after a version change.').length).toBeGreaterThan(0)
    expect(
      screen.queryByText('Saved session settings were cleared because the simulation contract changed.'),
    ).not.toBeInTheDocument()
  })
})
