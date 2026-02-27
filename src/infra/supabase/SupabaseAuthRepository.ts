import { supabase } from './client'
import type { AuthRepository } from '../../features/auth/application/ports/AuthRepository'
import type { AuthSession } from '../../features/auth/domain/AuthUser'

/**
 * Supabase implementation of AuthRepository.
 *
 * Maps Supabase session/user types to our domain AuthSession/AuthUser.
 * No Supabase types leak outside this file.
 */
export class SupabaseAuthRepository implements AuthRepository {
  async signInWithEmail(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    if (!data.session) throw new Error('No session returned after sign in')
    return this.mapSession(data.session)
  }

  async signUpWithEmail(email: string, password: string, name?: string): Promise<void> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: name ? { data: { full_name: name } } : undefined,
    })
    if (error) throw new Error(error.message)
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw new Error(error.message)
    if (!data.session) return null
    return this.mapSession(data.session)
  }

  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        callback(null)
        return
      }
      callback(this.mapSession(session))
    })
    return () => subscription.unsubscribe()
  }

  private mapSession(session: { access_token: string; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } }): AuthSession {
    return {
      user: {
        id: session.user.id,
        email: session.user.email ?? '',
        name: (session.user.user_metadata?.['full_name'] as string | undefined) ?? undefined,
      },
      accessToken: session.access_token,
    }
  }
}
