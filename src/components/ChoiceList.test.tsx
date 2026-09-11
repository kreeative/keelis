import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ChoiceList } from './ChoiceList'

const OPTIONS = [
  { value: 'a', title: 'Virement Interac' },
  { value: 'b', title: 'Compte bancaire' },
  { value: 'c', title: 'Dépôt de chèque', disabled: true },
  { value: 'd', title: 'Carte de débit' },
]

function Harness({ initial = 'a' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <MemoryRouter>
      <ChoiceList label="Provenance" value={value} onChange={setValue} options={OPTIONS} />
    </MemoryRouter>
  )
}

describe('ChoiceList', () => {
  it('exposes a radiogroup with one checked radio', () => {
    render(<Harness />)
    expect(screen.getByRole('radiogroup', { name: 'Provenance' })).toBeTruthy()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(4)
    expect(radios.filter((r) => r.getAttribute('aria-checked') === 'true')).toHaveLength(1)
  })

  it('keeps a single tab stop: the selection', () => {
    render(<Harness initial="b" />)
    const stops = screen.getAllByRole('radio').filter((r) => r.getAttribute('tabindex') === '0')
    expect(stops).toHaveLength(1)
    expect(stops[0]?.getAttribute('aria-checked')).toBe('true')
  })

  it('moves and selects with the arrow keys, skipping disabled options', async () => {
    const user = userEvent.setup()
    render(<Harness initial="b" />)
    await user.tab()
    await user.keyboard('{ArrowDown}')
    // 'c' is disabled, so the next enabled option is 'd'
    expect(screen.getByRole('radio', { name: 'Carte de débit' }).getAttribute('aria-checked')).toBe('true')
    await user.keyboard('{Home}')
    expect(screen.getByRole('radio', { name: 'Virement Interac' }).getAttribute('aria-checked')).toBe('true')
  })

  it('wraps around at the ends', async () => {
    const user = userEvent.setup()
    render(<Harness initial="a" />)
    await user.tab()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('radio', { name: 'Carte de débit' }).getAttribute('aria-checked')).toBe('true')
  })

  it('selects on click', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('radio', { name: 'Compte bancaire' }))
    expect(screen.getByRole('radio', { name: 'Compte bancaire' }).getAttribute('aria-checked')).toBe('true')
  })
})
