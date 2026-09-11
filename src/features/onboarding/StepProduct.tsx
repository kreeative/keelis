import { startTransition, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import type { AccountKind } from '@/api/types'
import { Icon, type IconName } from '@/components'
import { useSession } from '@/store'
import { cn } from '@/lib/cn'
import { StepShell } from './StepShell'
import { stepEyebrow } from './steps'
import { asApiError, useWizard } from './wizard'
import styles from './Steps.module.css'

interface Product {
  kind: AccountKind
  name: string
  description: string
  icon: IconName
  to: string
}

const PRODUCTS: readonly Product[] = [
  { kind: 'checking', name: 'Chèque', description: 'Compte de dépense et carte virtuelle', icon: 'credit-card', to: '/carte' },
  { kind: 'savings', name: 'Épargne', description: '4,00 % d’intérêt, sans minimum', icon: 'piggy-bank', to: '/epargne' },
  { kind: 'crypto', name: 'Crypto', description: '8 actifs, écart affiché avant chaque achat', icon: 'chart-line', to: '/crypto' },
]

export function StepProduct() {
  const navigate = useNavigate()
  const { setSession } = useSession()
  const { data, save, merge } = useWizard()
  const [choice, setChoice] = useState<AccountKind | null>(data.firstProduct ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const group = useRef<HTMLDivElement>(null)

  const select = (kind: AccountKind) => {
    setChoice(kind)
    setError(null)
    merge({ firstProduct: kind })
    void save({ firstProduct: kind, step: 'product' }).catch(() => {})
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const index = PRODUCTS.findIndex((p) => p.kind === choice)
    let next = index
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1 + PRODUCTS.length) % PRODUCTS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index <= 0 ? PRODUCTS.length : index) - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = PRODUCTS.length - 1
    else return
    e.preventDefault()
    const product = PRODUCTS[next]
    if (!product) return
    select(product.kind)
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }

  const submit = async () => {
    if (!choice) return
    setBusy(true)
    setError(null)
    try {
      await save({ firstProduct: choice, step: 'product' })
      const session = await api.auth.completeOnboarding()
      const to = PRODUCTS.find((p) => p.kind === choice)?.to ?? '/'
      // Session and route move in the same transition: otherwise the anonymous
      // guard sees an authenticated session on /inscription and sends us home.
      startTransition(() => {
        setSession(session)
        navigate(to, { replace: true })
      })
    } catch (err) {
      setError(asApiError(err, 'Impossible d’ouvrir votre compte. Réessayez.').message)
      setBusy(false)
    }
  }

  return (
    <StepShell
      eyebrow={stepEyebrow('produit')}
      title="Par quoi voulez-vous commencer ?"
      description="Les trois produits restent disponibles ; celui-ci s’ouvre en premier."
      submitLabel="Ouvrir Kaalis"
      submitDisabled={!choice}
      submitting={busy}
      onSubmit={() => void submit()}
    >
      <div ref={group} className={styles.choices} role="radiogroup" aria-label="Premier produit" onKeyDown={onKeyDown}>
        {PRODUCTS.map((p, i) => {
          const selected = p.kind === choice
          return (
            <button
              key={p.kind}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (!choice && i === 0) ? 0 : -1}
              className={cn(styles.choice, selected && styles.choiceOn)}
              onClick={() => select(p.kind)}
            >
              <span className={styles.choiceIcon} aria-hidden="true">
                <Icon name={p.icon} size={20} />
              </span>
              <span className={styles.choiceText}>
                <span className={styles.choiceName}>{p.name}</span>
                <span className={styles.choiceDesc}>{p.description}</span>
              </span>
              <span className={styles.choiceCheck} aria-hidden="true">
                {selected ? <Icon name="check" size={20} /> : null}
              </span>
            </button>
          )
        })}
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </StepShell>
  )
}
