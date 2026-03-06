import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AuthSession } from '../../domain/AuthUser'
import { useAuthRepository } from '@/app/AppDepsContext'

/** Inactivity timeout before automatic sign-out (10 minutes in ms) */
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000

/**
 * localStorage key for persisting the last-activity timestamp.
 * OWASP A07 — Identification and Authentication Failures:
 * Session expiration must survive browser restarts and tab reopens,
 * not only in-memory timeouts that reset when the process is killed.
 */
const LAST_ACTIVITY_KEY = 'jobtaylor-last-activity'

/** DOM events that reset the inactivity timer */
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const

/** Stamp the current time as the last known user activity. */
function stampActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
}

/** Remove the persisted activity timestamp (on sign-out). */
function clearActivityStamp() {
  localStorage.removeItem(LAST_ACTIVITY_KEY)
}

/**
 * Returns true if the stored last-activity timestamp is older than
 * INACTIVITY_TIMEOUT_MS, or if no timestamp exists (treat as expired).
 */
function isSessionExpiredByInactivity(): boolean {
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY)
  if (!raw) return true
  const elapsed = Date.now() - Number(raw)
  return elapsed >= INACTIVITY_TIMEOUT_MS
}

interface AuthContextValue {
  session: AuthSession | null
  /** true while the initial session check is in flight */
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const authRepository = useAuthRepository()
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Inactivity timeout ─────────────────────────────────────────────────────
  function clearInactivityTimer() {
    if (inactivityTimerRef.current !== null) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
  }

  function signOutDueToInactivity() {
    clearActivityStamp()
    authRepository.signOut().catch(() => {})
    setSession(null)
  }

  function resetInactivityTimer() {
    clearInactivityTimer()
    stampActivity()
    inactivityTimerRef.current = setTimeout(() => {
      // Sign out silently on inactivity — ProtectedRoute will redirect to /login
      signOutDueToInactivity()
    }, INACTIVITY_TIMEOUT_MS)
  }

  // Start / stop the inactivity timer based on whether there is an active session
  useEffect(() => {
    if (!session) {
      clearInactivityTimer()
      return
    }

    // Session is active — check whether the last recorded activity is too old
    // (covers the case where the browser / OS was closed and reopened).
    if (isSessionExpiredByInactivity()) {
      signOutDueToInactivity()
      return
    }

    // Session is active and not expired — start / resume the in-memory timer
    // for the remaining time, so the tab also auto-logs-out without needing
    // a page reload.
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY)
    const elapsed = raw ? Date.now() - Number(raw) : INACTIVITY_TIMEOUT_MS
    const remaining = Math.max(0, INACTIVITY_TIMEOUT_MS - elapsed)

    inactivityTimerRef.current = setTimeout(() => {
      signOutDueToInactivity()
    }, remaining)

    function handleActivity() {
      resetInactivityTimer()
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true })
    }

    return () => {
      clearInactivityTimer()
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // ── Session bootstrap ──────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Check if there is already a valid session (page refresh / tab reopen)
    authRepository.getSession()
      .then(supabaseSession => {
        // Even if Supabase still has a valid JWT, enforce our inactivity policy.
        if (supabaseSession && isSessionExpiredByInactivity()) {
          clearActivityStamp()
          authRepository.signOut().catch(() => {})
          setSession(null)
        } else {
          setSession(supabaseSession)
        }
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false))

    // 2. Subscribe to future changes (login, logout, token refresh)
    const unsubscribe = authRepository.onAuthStateChange(newSession => {
      setSession(newSession)
      setLoading(false)
    })

    return unsubscribe
  }, [authRepository])

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
