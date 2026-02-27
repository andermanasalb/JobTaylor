/**
 * Domain representation of an authenticated user.
 * Intentionally minimal — only what the app needs.
 * Decoupled from Supabase types.
 */
export interface AuthUser {
  id: string
  email: string
  name?: string
}

export interface AuthSession {
  user: AuthUser
  accessToken: string
}
