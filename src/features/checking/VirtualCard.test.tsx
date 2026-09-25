import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Card, CardSecrets } from '@/api/types'
import { VirtualCard, groupPan } from './VirtualCard'

const CARD: Card = { id: 'card_01', last4: '7364', holderName: 'AÏSSATOU NDIAYE', expiryMonth: 9, expiryYear: 2028, frozen: false, kind: 'virtual' }
const SECRETS: CardSecrets = { pan: '5412 7702 3391 7364', cvv: '318' }

/** The verso as assistive technology sees it — absent while the card faces front. */
const verso = () => screen.queryByRole('group', { name: 'Verso de la carte' })

describe('groupPan', () => {
  it('prints the number in four groups of four, however it arrived', () => {
    expect(groupPan('5412770233917364')).toBe('5412 7702 3391 7364')
    expect(groupPan('5412 7702 3391 7364')).toBe('5412 7702 3391 7364')
  })
})

describe('VirtualCard', () => {
  it('faces front until it is turned: the verso is hidden and the full number is nowhere', () => {
    render(<VirtualCard card={CARD} />)
    expect(verso()).toBeNull()
    expect(screen.queryByText(/5412/)).toBeNull()
    expect(screen.getByLabelText('Carte se terminant par 7 3 6 4')).toBeInTheDocument()
  })

  it('shows every number on the verso once turned, and hides the recto', () => {
    render(<VirtualCard card={CARD} turned secrets={SECRETS} />)
    const back = verso()
    expect(back).not.toBeNull()
    expect(within(back!).getByText(/5412 7702 3391 7364/)).toBeInTheDocument()
    expect(within(back!).getByText('09/28')).toBeInTheDocument()
    expect(within(back!).getByText('318')).toBeInTheDocument()
    expect(screen.getByLabelText('Carte se terminant par 7 3 6 4').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('masks what is secret on the verso while the numbers are on their way', () => {
    render(<VirtualCard card={CARD} turned />)
    const back = verso()!
    expect(within(back).getByText(/•••• •••• •••• 7364/)).toBeInTheDocument()
    expect(within(back).getByText('•••')).toBeInTheDocument()
    expect(screen.queryByText(/5412/)).toBeNull()
  })

  it('turns when it is touched', async () => {
    const onTurn = vi.fn()
    const { container } = render(<VirtualCard card={CARD} onTurn={onTurn} />)
    // The touch target is the card's last layer, over both sides.
    await userEvent.click(container.firstElementChild!.lastElementChild!)
    expect(onTurn).toHaveBeenCalledTimes(1)
  })

  it('never turns while frozen, never carries the numbers, and ignores a touch', async () => {
    const onTurn = vi.fn()
    const { container } = render(<VirtualCard card={{ ...CARD, frozen: true }} turned secrets={SECRETS} onTurn={onTurn} />)
    expect(verso()).toBeNull()
    expect(screen.queryByText(/5412/)).toBeNull()
    expect(screen.queryByText('318')).toBeNull()
    await userEvent.click(container.firstElementChild!)
    expect(onTurn).not.toHaveBeenCalled()
  })
})
