import { describe, it, expect } from 'vitest'
import { validatePassword } from './validatePassword'

describe('validatePassword', () => {
  // ── Invalid cases ────────────────────────────────────────────────────────────

  it('fails when password is shorter than 12 characters', () => {
    const result = validatePassword('Abc1!')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Mínimo 12 caracteres')
  })

  it('fails when password has no uppercase letter', () => {
    const result = validatePassword('abcdefghij1!')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Al menos una mayúscula')
  })

  it('fails when password has no lowercase letter', () => {
    const result = validatePassword('ABCDEFGHIJ1!')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Al menos una minúscula')
  })

  it('fails when password has no number', () => {
    const result = validatePassword('Abcdefghijk!')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Al menos un número')
  })

  it('fails when password has no special character', () => {
    const result = validatePassword('Abcdefghijk1')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Al menos un carácter especial')
  })

  it('returns strength "weak" for invalid passwords', () => {
    const result = validatePassword('abc')
    expect(result.strength).toBe('weak')
  })

  it('accumulates multiple errors at once', () => {
    const result = validatePassword('abc')
    expect(result.errors.length).toBeGreaterThan(1)
  })

  // ── Valid cases ──────────────────────────────────────────────────────────────

  it('returns isValid true and empty errors for a fully valid password', () => {
    const result = validatePassword('Abcdefghij1!')
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns strength "medium" for valid passwords with 12–15 characters', () => {
    const result = validatePassword('Abcdefghij1!')   // exactly 12 chars
    expect(result.isValid).toBe(true)
    expect(result.strength).toBe('medium')
  })

  it('returns strength "medium" for valid passwords with 15 characters', () => {
    const result = validatePassword('Abcdefghijk1!xy') // 15 chars
    expect(result.isValid).toBe(true)
    expect(result.strength).toBe('medium')
  })

  it('returns strength "strong" for valid passwords with 16+ characters', () => {
    const result = validatePassword('Abcdefghijk1!xyz') // 16 chars
    expect(result.isValid).toBe(true)
    expect(result.strength).toBe('strong')
  })
})
