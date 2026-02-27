import { useState } from 'react'
import type { AppSettings } from '@/features/settings/domain/AppSettings'
import { defaultSettings } from '@/features/settings/domain/AppSettings'

const STORAGE_KEY = 'jobtaylor-settings'

/**
 * Read the persisted AppSettings from localStorage.
 * Reads once on mount — sufficient because the user navigates
 * away from Settings before using export in other pages.
 */
export function useSettings(): AppSettings {
  const [settings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return defaultSettings
      return { ...defaultSettings, ...JSON.parse(raw) }
    } catch {
      return defaultSettings
    }
  })
  return settings
}
