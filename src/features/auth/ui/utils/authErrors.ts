/**
 * Maps raw Supabase/network error messages to user-friendly Spanish strings.
 *
 * Security note: we intentionally do NOT distinguish between "email not found"
 * and "wrong password" to prevent user enumeration attacks.
 */
export function mapAuthError(raw: string): string {
  const msg = raw.toLowerCase()

  // Supabase returns these for invalid credentials (both cases)
  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials') ||
    msg.includes('email not confirmed') ||
    msg.includes('wrong password') ||
    msg.includes('user not found')
  ) {
    return 'Email o contraseña incorrectos.'
  }

  if (msg.includes('email already registered') || msg.includes('user already registered')) {
    return 'Este email ya está registrado. ¿Quieres iniciar sesión?'
  }

  if (msg.includes('password should be at least')) {
    return 'La contraseña no cumple los requisitos mínimos.'
  }

  if (msg.includes('unable to validate email address') || msg.includes('invalid email')) {
    return 'El formato del email no es válido.'
  }

  if (msg.includes('email rate limit') || msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  }

  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Error de conexión. Comprueba tu red e inténtalo de nuevo.'
  }

  // Fallback — do not expose raw Supabase internals to the user
  return 'Ha ocurrido un error. Inténtalo de nuevo.'
}
