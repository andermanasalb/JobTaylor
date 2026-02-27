import { useState } from 'react'

export const PHOTO_STORAGE_KEY = 'jobtaylor-photo'

/**
 * Read the persisted profile photo from localStorage.
 * Returns a base64 data URL string, or undefined if none stored.
 * Reads once on mount.
 */
export function usePhoto(): string | undefined {
  const [photo] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(PHOTO_STORAGE_KEY) ?? undefined
    } catch {
      return undefined
    }
  })
  return photo
}
