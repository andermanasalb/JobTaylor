import type { AuthSession } from '../../domain/AuthUser'

/**
 * Port: authentication operations.
 *
 * Implementations live in src/infra/supabase/SupabaseAuthRepository.ts
 * (and a FakeAuthRepository for tests).
 *
 * Rules:
 * - No Supabase SDK types leak through this interface.
 * - All methods return plain domain types or void.
 */
export interface AuthRepository {
  /**
   * Sign in with email and password.
   * Throws if credentials are invalid.
   */
  signInWithEmail(email: string, password: string): Promise<AuthSession>

  /**
   * Register a new account with email, password, and optional display name.
   * Supabase will send a confirmation email automatically (disabled locally).
   * Throws if email is already in use.
   */
  signUpWithEmail(email: string, password: string, name?: string): Promise<void>

  /**
   * Sign out the current user and clear the local session.
   */
  signOut(): Promise<void>

  /**
   * Return the current session if one exists, or null if not authenticated.
   */
  getSession(): Promise<AuthSession | null>

  /**
   * Subscribe to auth state changes (login, logout, token refresh).
   * Returns an unsubscribe function to call on cleanup.
   */
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void
}
