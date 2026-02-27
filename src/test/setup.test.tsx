import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

function Hello({ name }: { name: string }) {
  return <p>Hello, {name}!</p>
}

describe('Vitest + Testing Library', () => {
  it('renders a React component', () => {
    render(<Hello name="JobTaylor" />)
    expect(screen.getByText('Hello, JobTaylor!')).toBeInTheDocument()
  })
})
