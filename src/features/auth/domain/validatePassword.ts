export type PasswordStrength = 'weak' | 'medium' | 'strong'

export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
  strength: PasswordStrength
}

const RULES: Array<{ message: string; test: (p: string) => boolean }> = [
  { message: 'Mínimo 12 caracteres',          test: p => p.length >= 12 },
  { message: 'Al menos una mayúscula',         test: p => /[A-Z]/.test(p) },
  { message: 'Al menos una minúscula',         test: p => /[a-z]/.test(p) },
  { message: 'Al menos un número',             test: p => /[0-9]/.test(p) },
  { message: 'Al menos un carácter especial',  test: p => /[^A-Za-z0-9]/.test(p) },
]

export function validatePassword(password: string): PasswordValidationResult {
  const errors = RULES
    .filter(rule => !rule.test(password))
    .map(rule => rule.message)

  const isValid = errors.length === 0

  let strength: PasswordStrength = 'weak'
  if (isValid) {
    strength = password.length >= 16 ? 'strong' : 'medium'
  }

  return { isValid, errors, strength }
}
