import { expect, test } from '@playwright/test'
import { buildScenarioArtifact, serializeArtifact } from '../../src/domain/artifacts'
import { BUILT_IN_SCENARIOS } from '../../src/domain/scenarios'

test('saves a baseline experiment in the lab and compares it against a new run', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Evolution Sandbox' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Workspace surfaces' })).toBeVisible()
  await expect(page.getByText('Recommended next action')).toBeVisible()
  await page.getByRole('button', { name: 'Fast-forward' }).click()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Save Experiment' }).click()

  await page.getByRole('button', { name: 'Reset' }).click()
  await page.getByRole('button', { name: 'Reseed' }).click()
  await page.getByRole('button', { name: 'Fast-forward' }).click()
  await page.getByRole('button', { name: 'Run', exact: true }).click()

  await page.getByRole('button', { name: 'Open Lab' }).click()
  await expect(page.getByRole('heading', { name: 'Saved experiments' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Import experiment' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Clear baseline' })).toBeVisible()
  await page.getByRole('tab', { name: 'Sandbox' }).click()

  await expect(page.getByRole('button', { name: 'Compare baseline' })).toBeEnabled()
  await page.getByRole('button', { name: 'Compare baseline' }).click()
  await expect(page.getByTestId('comparison-panel')).toBeVisible()
  await expect(page.getByRole('main').getByText('Diversity score', { exact: true })).toBeVisible()
})

test('allows comparing an identical rerun against a saved baseline to validate determinism', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Fast-forward' }).click()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await page.getByRole('button', { name: 'Save Experiment' }).click()
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.getByRole('button', { name: 'Fast-forward' }).click()
  await page.getByRole('button', { name: 'Run', exact: true }).click()

  await page.getByRole('button', { name: 'Open Lab' }).click()
  await expect(page.getByRole('heading', { name: 'Saved experiments' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Clear baseline' })).toBeVisible()
  await page.getByRole('tab', { name: 'Sandbox' }).click()

  await expect(page.getByRole('button', { name: 'Compare baseline' })).toBeEnabled()
  await page.getByRole('button', { name: 'Compare baseline' }).click()
  await expect(page.getByTestId('comparison-panel')).toContainText(/held steady|grew|shrank/i)
  await expect(page.getByTestId('comparison-panel')).toContainText('Mean trait deltas')
  await expect(page.getByTestId('comparison-panel')).toContainText('stayed effectively unchanged')
  await expect(page.getByRole('main').getByText('Dominant phenotype', { exact: true })).toBeVisible()
})

test('exposes portable scenario controls in the scenario studio', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('tab', { name: 'Scenarios' }).click()

  await expect(page.getByRole('heading', { name: 'Design staged worlds' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Import scenario' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export scenario' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Try the sharing flow without making your own file first/i })).toBeVisible()
})

test('reviews a scenario file before import so the user can confirm the outcome', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('tab', { name: 'Scenarios' }).click()

  const artifact = buildScenarioArtifact(BUILT_IN_SCENARIOS[0]!)
  await page.getByLabel('Choose scenario file').setInputFiles({
    name: 'balanced-world.scenario.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeArtifact(artifact)),
  })

  await expect(page.getByText('Import Review')).toBeVisible()
  await expect(page.getByText(/already matches a scenario in the local library/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use local scenario' })).toBeVisible()
})

test('supports keyboard switching across workspace tabs', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('tab', { name: 'Sandbox' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Scenarios', selected: true })).toBeFocused()

  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: 'Lab', selected: true })).toBeFocused()

  await page.keyboard.press('Home')
  await expect(page.getByRole('tab', { name: 'Sandbox', selected: true })).toBeFocused()
})
