import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { AuthSession } from '../../domain/AuthUser'
import { useAuthRepository } from '@/app/AppDepsContext'

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

  useEffect(() => {
    // 1. Check if there is already a valid session (page refresh / tab reopen)
    authRepository.getSession()
      .then(setSession)
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
