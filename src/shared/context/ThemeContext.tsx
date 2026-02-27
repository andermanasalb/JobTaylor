import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  /** The stored preference ('light' | 'dark' | 'system'). */
  theme: Theme
  /** The actual resolved theme applied to the DOM ('light' | 'dark'). */
  resolvedTheme: 'light' | 'dark'
  /** Update the stored preference and immediately apply it. */
  setTheme: (theme: Theme) => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'jobtaylor-theme'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
    return 'light'
  })

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? getSystemTheme() : theme

  // Apply on mount and whenever resolved theme changes
  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  // Listen for OS-level preference changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(getSystemTheme())
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  function setTheme(next: Theme) {
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}
