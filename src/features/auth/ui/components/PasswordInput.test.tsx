import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PasswordInput } from './PasswordInput'

describe('PasswordInput', () => {
  it('renders a password input', () => {
    render(<PasswordInput value="" onChange={() => {}} />)
    // password inputs are not in the accessible tree as 'textbox'; query by aria-label directly
    const input = document.querySelector('input[aria-label="Contraseña"]')
    expect(input).not.toBeNull()
  })

  it('input starts as type password (hidden)', () => {
    render(<PasswordInput value="" onChange={() => {}} />)
    const input = document.querySelector('input')
    expect(input?.type).toBe('password')
  })

  it('calls onChange when the user types', () => {
    const handler = vi.fn()
    render(<PasswordInput value="" onChange={handler} />)
    const input = document.querySelector('input')!
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(handler).toHaveBeenCalledWith('abc')
  })

  it('toggles input type to text when show-password button is clicked', () => {
    render(<PasswordInput value="" onChange={() => {}} />)
    const toggle = screen.getByRole('button')
    fireEvent.click(toggle)
    const input = document.querySelector('input')
    expect(input?.type).toBe('text')
  })

  it('shows requirements list when showRequirements is true', () => {
    render(<PasswordInput value="" onChange={() => {}} showRequirements />)
    expect(screen.getByText('Mínimo 12 caracteres')).toBeInTheDocument()
    expect(screen.getByText('Al menos una mayúscula')).toBeInTheDocument()
    expect(screen.getByText('Al menos una minúscula')).toBeInTheDocument()
    expect(screen.getByText('Al menos un número')).toBeInTheDocument()
    expect(screen.getByText('Al menos un carácter especial')).toBeInTheDocument()
  })

  it('does not show requirements when showRequirements is false (default)', () => {
    render(<PasswordInput value="" onChange={() => {}} />)
    expect(screen.queryByText('Mínimo 12 caracteres')).not.toBeInTheDocument()
  })

  it('shows strength indicator when showRequirements is true', () => {
    render(<PasswordInput value="Abcdefghij1!" onChange={() => {}} showRequirements />)
    // strength bar or label must be present
    const strengthEl = document.querySelector('[data-strength]')
    expect(strengthEl).not.toBeNull()
  })

  it('marks a passing requirement with a checkmark indicator', () => {
    render(<PasswordInput value="Abcdefghij1!" onChange={() => {}} showRequirements />)
    // All rules pass for this password — check that at least one "pass" indicator exists
    const passing = document.querySelectorAll('[data-rule-status="pass"]')
    expect(passing.length).toBeGreaterThan(0)
  })

  it('marks a failing requirement with a fail indicator', () => {
    render(<PasswordInput value="abc" onChange={() => {}} showRequirements />)
    const failing = document.querySelectorAll('[data-rule-status="fail"]')
    expect(failing.length).toBeGreaterThan(0)
  })
})
