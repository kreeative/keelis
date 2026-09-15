/**
 * Virtual card block: the card itself, the reveal panel (auto-hides after 30 s)
 * and the freeze switch (optimistic, with rollback).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api'
import type { Card, CardSecrets } from '@/api/types'
import { Button, ErrorState, Icon, ListRow, Skeleton, Switch } from '@/components'
import { QK, setQueryData, useToast } from '@/store'
import { useCard } from '@/features/shared'
import { cn } from '@/lib/cn'
import { VirtualCard, VirtualCardSkeleton, expiryLabel } from './VirtualCard'
import styles from './CardPanel.module.css'

const REVEAL_SECONDS = 30

function groupPan(pan: string): string {
  return pan
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

export function CardPanel({ className }: { className?: string }) {
  const { toast } = useToast()
  const cardQuery = useCard()
  const card = cardQuery.data
  const [secrets, setSecrets] = useState<CardSecrets | null>(null)
  const [left, setLeft] = useState(REVEAL_SECONDS)
  const [revealing, setRevealing] = useState(false)
  const [freezing, setFreezing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = useCallback(() => {
    setSecrets(null)
    setLeft(REVEAL_SECONDS)
  }, [])

  // Countdown, then auto-hide.
  useEffect(() => {
    if (!secrets) return
    if (left <= 0) {
      hide()
      return
    }
    timer.current = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [secrets, left, hide])

  // A frozen card never shows its numbers.
  useEffect(() => {
    if (card?.frozen) hide()
  }, [card?.frozen, hide])

  const frozen = card?.frozen ?? false

  const reveal = async () => {
    if (!card || frozen) return
    setRevealing(true)
    try {
      const s = await api.card.reveal()
      setLeft(REVEAL_SECONDS)
      setSecrets(s)
    } catch {
      toast('Impossible d’afficher les numéros pour l’instant', 'error')
    } finally {
      setRevealing(false)
    }
  }

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast(`${label} copié`)
    } catch {
      toast('Impossible de copier', 'error')
    }
  }

  const setFrozen = async (next: boolean) => {
    if (!card) return
    const previous = card
    setFreezing(true)
    setQueryData<Card>(QK.card, (prev) => ({ ...(prev ?? previous), frozen: next }))
    try {
      await api.card.setFrozen(next)
      toast(next ? 'Carte gelée' : 'Carte réactivée')
    } catch {
      setQueryData<Card>(QK.card, () => previous)
      toast('Le changement n’a pas pu être enregistré', 'error')
    } finally {
      setFreezing(false)
    }
  }

  if (cardQuery.error && !card) {
    return (
      <section className={cn(styles.panel, className)} aria-label="Carte virtuelle">
        <ErrorState compact error={cardQuery.error} onRetry={() => void cardQuery.refetch()} />
      </section>
    )
  }

  return (
    <section className={cn(styles.panel, className)} aria-label="Carte virtuelle" aria-busy={!card || undefined}>
      {card ? <VirtualCard card={card} /> : <VirtualCardSkeleton />}

      <div className={styles.reveal}>
        {secrets && card ? (
          <div className={styles.secrets} role="group" aria-label="Numéros de la carte">
            <dl className={styles.rows}>
              <div className={styles.row}>
                <dt className={styles.rowLabel}>Numéro</dt>
                <dd className={styles.rowValue}>
                  <span className={styles.mono}>{groupPan(secrets.pan)}</span>
                  <Button variant="ghost" iconOnly aria-label="Copier le numéro de la carte" onClick={() => void copy(secrets.pan.replace(/\s+/g, ''), 'Numéro')} className={styles.copy}>
                    <Icon name="copy" size={18} />
                  </Button>
                </dd>
              </div>
              <div className={styles.row}>
                <dt className={styles.rowLabel}>Code de sécurité</dt>
                <dd className={styles.rowValue}>
                  <span className={styles.mono}>{secrets.cvv}</span>
                  <Button variant="ghost" iconOnly aria-label="Copier le code de sécurité" onClick={() => void copy(secrets.cvv, 'Code de sécurité')} className={styles.copy}>
                    <Icon name="copy" size={18} />
                  </Button>
                </dd>
              </div>
              <div className={styles.row}>
                <dt className={styles.rowLabel}>Expiration</dt>
                <dd className={styles.rowValue}>
                  <span className={styles.mono}>{expiryLabel(card)}</span>
                  <Button variant="ghost" iconOnly aria-label="Copier la date d’expiration" onClick={() => void copy(expiryLabel(card), 'Date d’expiration')} className={styles.copy}>
                    <Icon name="copy" size={18} />
                  </Button>
                </dd>
              </div>
            </dl>
            <div className={styles.revealFoot}>
              <p className={styles.countdown}>Masquage dans {left} s</p>
              <Button variant="ghost" onClick={hide} icon={<Icon name="eye-off" size={18} />}>
                Masquer
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button variant="ghost" onClick={() => void reveal()} loading={revealing} disabled={!card || frozen} icon={<Icon name="eye" size={18} />} className={styles.revealBtn}>
              Afficher les numéros
            </Button>
            {frozen ? <p className={styles.hint}>Réactivez la carte pour afficher les numéros.</p> : null}
          </>
        )}
      </div>

      <div className={styles.freeze}>
        {card ? (
          <ListRow
            title="Geler la carte"
            /* `wrap`, because the sentence is the whole point of the row: a switch that
               freezes a card has to say what freezing does, and truncated it read « Bloque
               les paiements instantané… ». It needs 258px and the row gives it 238 at 390px
               and 168 at 320 — cut at every width the app supports. */
            wrap
            subtitle="Bloque les paiements instantanément"
            leading={
              <span className={styles.freezeIcon} aria-hidden="true">
                <Icon name="snowflake" size={20} />
              </span>
            }
            trailing={<Switch checked={frozen} onChange={(next) => void setFrozen(next)} label="Geler la carte" loading={freezing} />}
          />
        ) : (
          <Skeleton height="var(--row-height)" />
        )}
      </div>
    </section>
  )
}
