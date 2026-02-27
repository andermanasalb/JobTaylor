import type { AuthRepository } from '../../features/auth/application/ports/AuthRepository'
import type { AuthSession } from '../../features/auth/domain/AuthUser'

/**
 * No-op AuthRepository for Stage 0 (no real auth).
 * Always returns null session — used when VITE_USE_SUPABASE is false.
 */
export class FakeAuthRepository implements AuthRepository {
  async signInWithEmail(_email: string, _password: string): Promise<AuthSession> {
    throw new Error('FakeAuthRepository: signInWithEmail not implemented in Stage 0')
  }

  async signUpWithEmail(_email: string, _password: string, _name?: string): Promise<void> {
    throw new Error('FakeAuthRepository: signUpWithEmail not implemented in Stage 0')
  }

  async signOut(): Promise<void> {
    // no-op
  }

  async getSession(): Promise<AuthSession | null> {
    return null
  }

  onAuthStateChange(_callback: (session: AuthSession | null) => void): () => void {
    return () => { /* no-op */ }
  }
}
