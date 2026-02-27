import { useState, useEffect } from 'react'
import type { AppSettings } from '@/features/settings/domain/AppSettings'
import { defaultSettings } from '@/features/settings/domain/AppSettings'

const STORAGE_KEY = 'jobtaylor-settings'

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return defaultSettings
  }
}

/**
 * Lee AppSettings de localStorage y se mantiene reactivo:
 * cualquier cambio guardado desde SettingsPage (misma pestaña)
 * se propaga inmediatamente a todos los componentes que usen este hook.
 */
export function useSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(readSettings)

  useEffect(() => {
    // Escucha el evento custom que SettingsPage dispara al guardar
    function handleSettingsChanged() {
      setSettings(readSettings())
    }
    window.addEventListener('jobtaylor-settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('jobtaylor-settings-changed', handleSettingsChanged)
  }, [])

  return settings
}
