import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Scissors, Mail, Loader2, User, Sun, Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useAuthRepository } from '@/app/AppDepsContext'
import { PasswordInput } from '../components/PasswordInput'
import { validatePassword } from '@/features/auth/domain/validatePassword'
import { mapAuthError } from '../utils/authErrors'
import { useTheme } from '@/shared/context/ThemeContext'

type Mode = 'login' | 'register'

const MAX_ATTEMPTS = 3
const LOCKOUT_SECONDS = 60

/**
 * Per-email rate limiting state. Module-level so it is not reset when switching
 * between login and register modes, but IS reset on page reload (intentional —
 * this is a lightweight UI guard, not a security control).
 */
interface EmailRateLimit {
  attempts: number
  lockedUntil: number | null
}
const emailRateLimitMap = new Map<string, EmailRateLimit>()

/** Basic email format check — just catches obvious typos, Supabase validates properly server-side. */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function LoginPage() {
  const authRepository = useAuthRepository()
  const navigate = useNavigate()
  const location = useLocation()
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useTranslation()

  // Where to redirect after successful login (supports returnTo via router state)
  const from = (location.state as { from?: string } | null)?.from ?? '/search'

  const [mode, setMode] = useState<Mode>('login')

  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)

  // Rate limiting — derived from per-email module-level map; use a counter to
  // force re-renders after each failed attempt without storing state in useState.
  const [rateLimitTick, setRateLimitTick] = useState(0)
  // rateLimitTick is intentionally only written, never read directly —
  // its sole purpose is to trigger a re-render so the map read below reflects
  // the latest state. The void suppresses the unused-variable lint rule.
  void rateLimitTick
  const trimmedEmailForLimit = email.trim().toLowerCase()
  const emailLimit = emailRateLimitMap.get(trimmedEmailForLimit) ?? { attempts: 0, lockedUntil: null }
  const isLocked = emailLimit.lockedUntil !== null && Date.now() < emailLimit.lockedUntil
  const remainingAttempts = MAX_ATTEMPTS - emailLimit.attempts

  // ── Derived validation ──────────────────────────────────────────────────────
  const emailValid = isValidEmail(email)
  const passwordValidation = validatePassword(password)
  const passwordsMatch = password === confirmPassword

  const loginFormValid = emailValid && password.length > 0
  const registerFormValid =
    emailValid &&
    name.trim().length > 0 &&
    passwordValidation.isValid &&
    passwordsMatch

  const canSubmit = !loading && !isLocked && (mode === 'login' ? loginFormValid : registerFormValid)

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setError(null)
    setLoading(true)

    // Trim email to avoid whitespace mistakes
    const trimmedEmail = email.trim().toLowerCase()

    try {
      if (mode === 'login') {
        await authRepository.signInWithEmail(trimmedEmail, password)
        // Stamp activity so the inactivity check in AuthContext does not
        // immediately expire the session we just created (OWASP A07).
        localStorage.setItem('jobtaylor-last-activity', String(Date.now()))
        navigate(from, { replace: true })
      } else {
        await authRepository.signUpWithEmail(trimmedEmail, password, name.trim())
        // Ensure the default output language is ES for new accounts
        try {
          const raw = localStorage.getItem('jobtaylor-settings')
          const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
          if (!existing.outputLanguage) {
            localStorage.setItem('jobtaylor-settings', JSON.stringify({ ...existing, outputLanguage: 'ES' }))
          }
        } catch { /* localStorage unavailable — silently ignore */ }
        setRegistered(true)
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Unknown error'
      const friendly = mapAuthError(raw)
      setError(friendly)

      // Rate limiting only applies to login attempts
      if (mode === 'login') {
        const current = emailRateLimitMap.get(trimmedEmail) ?? { attempts: 0, lockedUntil: null }
        const newAttempts = current.attempts + 1
        const newLockedUntil = newAttempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_SECONDS * 1000 : current.lockedUntil
        emailRateLimitMap.set(trimmedEmail, { attempts: newAttempts, lockedUntil: newLockedUntil })
        setRateLimitTick(t => t + 1)
      }
    } finally {
      setLoading(false)
    }
  }

  function toggleMode() {
    setMode(m => (m === 'login' ? 'register' : 'login'))
    setError(null)
    setRegistered(false)
    setRateLimitTick(0)
  }

  const disabled = loading || isLocked

  return (
    <div className="flex h-dvh items-center justify-center bg-background px-4">
      {/* Theme toggle — fixed bottom-left */}
      <button
        type="button"
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        aria-label={resolvedTheme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
        className="fixed bottom-4 left-4 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
      >
        {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary mb-3">
            <Scissors className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">JobTaylor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
          </p>
        </div>

        {/* Post-registration success */}
        {registered ? (
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 text-center">
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              {t('auth.accountCreated')}
            </p>
            <p className="text-xs text-green-700 dark:text-green-400 mt-1">
              {t('auth.canSignIn')}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-xs"
              onClick={() => { setMode('login'); setRegistered(false) }}
            >
              {t('auth.signInButton')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

            {/* Name (register only) */}
            {mode === 'register' && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                   placeholder={t('auth.fullName')}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="pl-9"
                  required
                  autoComplete="name"
                  aria-label={t('auth.fullName')}
                  disabled={disabled}
                />
              </div>
            )}

            {/* Email */}
            <div className="flex flex-col gap-1">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <Input
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-9"
                  required
                  autoComplete="email"
                  aria-label={t('auth.email')}
                  disabled={disabled}
                  aria-invalid={email.length > 0 && !emailValid}
                />
              </div>
              {email.length > 0 && !emailValid && (
                <p className="text-xs text-destructive pl-1">{t('auth.invalidEmail')}</p>
              )}
            </div>

            {/* Password */}
            <PasswordInput
              value={password}
              onChange={setPassword}
              showRequirements={mode === 'register'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={disabled}
            />

            {/* Confirm password (register only) */}
            {mode === 'register' && (
              <div className="flex flex-col gap-1">
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  placeholder={t('auth.repeatPassword')}
                  ariaLabel={t('auth.confirmPassword')}
                  disabled={disabled}
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive pl-1">{t('auth.passwordMismatch')}</p>
                )}
              </div>
            )}

            {/* Lockout message */}
            {isLocked && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive text-center">
                {t('auth.tooManyAttempts', { seconds: LOCKOUT_SECONDS })}
              </div>
            )}

            {/* Error */}
            {error && !isLocked && (
              <div className="flex flex-col gap-0.5">
                <p className="text-xs text-destructive text-center">{error}</p>
                  {mode === 'login' && emailLimit.attempts > 0 && emailLimit.attempts < MAX_ATTEMPTS && (
                    <p className="text-xs text-muted-foreground text-center">
                      {t('auth.remainingAttempts', { count: remainingAttempts })}
                    </p>
                  )}
              </div>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {loading
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('auth.loading')}</>
                : mode === 'login' ? t('auth.signInButton') : t('auth.registerButton')
              }
            </Button>

            {/* Toggle */}
            <p className="text-center text-xs text-muted-foreground">
              {mode === 'login' ? (
                <>
                  {t('auth.noAccount')}{' '}
                  <button type="button" onClick={toggleMode} className="font-medium text-primary hover:underline">
                    {t('auth.register')}
                  </button>
                </>
              ) : (
                <>
                  {t('auth.hasAccount')}{' '}
                  <button type="button" onClick={toggleMode} className="font-medium text-primary hover:underline">
                    {t('auth.signInLink')}
                  </button>
                </>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
