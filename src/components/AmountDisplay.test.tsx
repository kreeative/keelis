import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AmountDisplay } from './AmountDisplay'
import { SettingsProvider } from '@/store/settings'

const wrap = (ui: React.ReactNode) => render(<SettingsProvider>{ui}</SettingsProvider>)
const norm = (s: string) => s.replace(/[  ]/g, ' ')

describe('AmountDisplay', () => {
  it('renders a quantity with its unit, not a currency', () => {
    wrap(<AmountDisplay value={0.0428} unit="BTC" />)
    expect(norm(screen.getByRole('text').textContent ?? '')).toBe('0.0428BTC')
    expect(screen.queryByText('$')).toBeNull()
  })

  it('prefixes an explicit sign when asked', () => {
    wrap(<AmountDisplay value={2184.5} signed />)
    expect(norm(screen.getByRole('text').textContent ?? '')).toContain('+2,185')
  })

  it('labels the amount in long form for screen readers', () => {
    wrap(<AmountDisplay value={1234.56} />)
    expect(screen.getByRole('text').getAttribute('aria-label')).toMatch(/francs CFA/)
  })
})
