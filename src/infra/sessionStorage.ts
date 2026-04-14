import { SIM_RULESET_VERSION, STORAGE_KEYS, STORAGE_SCHEMA_VERSION, normalizeConfig } from '@/domain/config'
import type { AppNotice, AppSurface, PersistedPayload, SimulationConfig, StoredSettings } from '@/domain/types'

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function parsePayload<T>(raw: string | null): PersistedPayload<T> | null {
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as PersistedPayload<T>
  } catch {
    return null
  }
}

export function loadStoredSettings(): { settings: StoredSettings | null; notice: AppNotice | null } {
  const storage = getStorage()
  if (!storage) {
    return { settings: null, notice: null }
  }

  const raw = storage.getItem(STORAGE_KEYS.settings)
  const parsed = parsePayload<StoredSettings>(raw)
  if (raw && !parsed) {
    storage.removeItem(STORAGE_KEYS.settings)
    return {
      settings: null,
      notice: {
        level: 'warning',
        message: 'Saved session settings were cleared because the stored data could not be read.',
      },
    }
  }

  if (!parsed) {
    return { settings: null, notice: null }
  }

  if (parsed.schemaVersion !== STORAGE_SCHEMA_VERSION || parsed.rulesetVersion !== SIM_RULESET_VERSION) {
    storage.removeItem(STORAGE_KEYS.settings)
    return {
      settings: null,
      notice: {
        level: 'warning',
        message: 'Saved session settings were cleared because the simulation contract changed.',
      },
    }
  }

  return {
    settings: {
      ...parsed.payload,
      config: normalizeConfig(parsed.payload.config),
    },
    notice: null,
  }
}

export function saveStoredSettings(
  config: SimulationConfig,
  selectedScenarioId: string,
  baselineExperimentId: string | null,
  surface: AppSurface,
): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  const payload: PersistedPayload<StoredSettings> = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    rulesetVersion: SIM_RULESET_VERSION,
    savedAt: new Date().toISOString(),
    payload: {
      rulesetVersion: SIM_RULESET_VERSION,
      selectedScenarioId,
      baselineExperimentId,
      surface,
      config,
    },
  }

  try {
    storage.setItem(STORAGE_KEYS.settings, JSON.stringify(payload))
  } catch {
    // Ignore storage write failures so the app stays usable in restricted browser modes.
  }
}
